import { DynamoDB, SNS } from "aws-sdk"
import { Order, OrderRepository } from "/opt/nodejs/ordersLayer"
import { Product, ProductRepository } from "/opt/nodejs/productsLayer"
import * as awsRAY from "aws-xray-sdk"
import { APIGatewayProxyEvent, APIGatewayProxyResult, Context } from "aws-lambda"
import { CarrierType, OrderProductResponse, OrderRequest, OrderResponse, PaymentType, ShippingType } from "/opt/nodejs/ordersApiLayer"
import { OrderEvent, OrderEventType, OrderEventMessage } from '/opt/nodejs/ordersEventsLayer'
import { v4 as uuid } from "uuid"

awsRAY.captureAWS(require("aws-sdk"))

const ordersDdb = process.env.ORDERS_DDB!
const productsDdb = process.env.PRODUCTS_DDB!

const orderEventTopicArn = process.env.ORDERS_EVENTS_TOPIC_ARN!

const ddbClient = new DynamoDB.DocumentClient()
const snsClient = new SNS()

const orderRepository = new OrderRepository(ddbClient, ordersDdb)
const productRepository = new ProductRepository(ddbClient, productsDdb)

function buildOrder(orderRequest: OrderRequest, products: Product[]): Order {
    const orderProducts: OrderProductResponse[] = []
    let totalPrice = 0

    products.forEach(product => {
        totalPrice += product.price
        orderProducts.push({
            code: product.code,
            price: product.price
        })
    })
    
    const order: Order = {
        pk: orderRequest.email,
        sk: uuid(),
        createdAt: Date.now(),
        billing: {
            payment: orderRequest.payment,
            totalPrice
        },
        shipping: {
            type: orderRequest.shipping.type,
            carrier: orderRequest.shipping.carrier
        },
        products: orderProducts
    }

    return order
}

function convertToOrderResponse(order: Order): OrderResponse {
    const orderProducts: OrderProductResponse[] = []

    order.products.forEach(product => {
        orderProducts.push({
            code: product.code,
            price: product.price
        })
    })

    const orderResponse: OrderResponse = {
        email: order.pk,
        id: order.sk!,
        createdAt: order.createdAt!,
        products: orderProducts,
        billing: {
            payment: order.billing.payment as PaymentType,
            totalPrice: order.billing.totalPrice
        },
        shipping: {
            type: order.shipping.type as ShippingType,
            carrier: order.shipping.carrier as CarrierType
        }
    }

    return orderResponse
}

function sendOrderEvent(order: Order, eventType: OrderEventType, lambdaRequestId: string) {
    const productCodes: string[] = []

    order.products.forEach(product => {
        productCodes.push(product.code)
    })

    const orderEvent: OrderEvent = {
        email: order.pk,
        orderId: order.sk!,
        shipping: order.shipping,
        billing: order.billing,
        productCodes,
        requestId: lambdaRequestId,
    }

    const orderEventMessage: OrderEventMessage = {
        eventType,
        data: orderEvent
    }

    return snsClient.publish({
        TopicArn: orderEventTopicArn,
        Message: JSON.stringify(orderEventMessage)
    }).promise()
}

export async function handler(event: APIGatewayProxyEvent, context: Context): Promise<APIGatewayProxyResult> {
    const { httpMethod } = event
    const apiRequestId = event.requestContext.requestId
    const lambdaRequestId = context.awsRequestId

    console.log(`API Gatewat RequestId: ${apiRequestId} - Lambda RequestId: ${lambdaRequestId}`)

    if(httpMethod === 'GET') {
        if(event.queryStringParameters) {
            const email = event.queryStringParameters!.email
            const orderId = event.queryStringParameters!.orderId

            if(email) {
                if(orderId) {
                    // GET one order from user
                    try {
                        const order = await orderRepository.getOrder(email, orderId)

                        return {
                            statusCode: 200,
                            body: JSON.stringify(convertToOrderResponse(order))
                        }
                    } catch (err) {
                        console.log((<Error>err).message)
                        
                        return {
                            statusCode: 404,
                            body: (<Error>err).message
                        }
                    }

                } else {
                    // GET all order from user
                    const orders = await orderRepository.getOrdersByEmail(email)

                    return {
                        statusCode: 200,
                        body: JSON.stringify(orders.map(convertToOrderResponse))
                    }
                }
            }
        } else {
            // GET all orders
            const orders = await orderRepository.getAllOrders()
            
            return {
                statusCode: 200,
                body: JSON.stringify(orders.map(convertToOrderResponse))
            }
        }

    } else if(httpMethod === 'POST') {
        console.log('POST /orders')

        const orderRequest = JSON.parse(event.body!) as OrderRequest
        const products = await productRepository.getProductsByIds(orderRequest.productIds)

        if(products.length === orderRequest.productIds.length) {
            const order = buildOrder(orderRequest, products)
            const orderCreatedPromise = orderRepository.createOrder(order)

            const eventResultPromise = sendOrderEvent(order, OrderEventType.CREATED, lambdaRequestId)

            const results = await Promise.all([orderCreatedPromise, eventResultPromise])

            console.log(`Order Created event sent - OrderID: ${order.sk} - Message ID: ${results[1].MessageId}`)

            return {
                statusCode: 201,
                body: JSON.stringify(convertToOrderResponse(order))
            }
        } else {
            return {
                statusCode: 404,
                body: 'Some product was not found'
            }
        }

    } else if(httpMethod === 'DELETE') {
        console.log('DELETE /orders')

        const email = event.queryStringParameters!.email!
        const orderId = event.queryStringParameters!.orderId!

        try {
            const orderDeleted = await orderRepository.deleteOrder(email, orderId)

            const eventResult = await sendOrderEvent(orderDeleted, OrderEventType.CREATED, lambdaRequestId)
            console.log(`Order Deleted event sent - OrderID: ${orderDeleted.sk} - Message ID: ${eventResult.MessageId}`)

            return {
                statusCode: 200,
                body: JSON.stringify(convertToOrderResponse(orderDeleted))
            }
        } catch (err) {
            console.log((<Error>err).message)

            return {
                statusCode: 404,
                body: (<Error>err).message
            }
        }
    }

    return {
        statusCode: 400,
        body: 'Bad Request'
    }
}