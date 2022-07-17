import { APIGatewayProxyEvent, APIGatewayProxyResult, Context } from "aws-lambda";
import { Product, ProductRepository } from "/opt/nodejs/productsLayer";
import { DynamoDB, Lambda } from "aws-sdk"
import { ProductEvent, ProductEventType } from "/opt/nodejs/productsEventsLayer";
import * as awsXRAY from "aws-xray-sdk"

awsXRAY.captureAWS(require("aws-sdk"))

const productsDdb = process.env.PRODUCTS_DDB!
const productsEventsFunctionName = process.env.PRODUCTS_EVENTS_FUNCTION_NAME!
const ddbClient = new DynamoDB.DocumentClient()
const lambdaClient = new Lambda()

const productRepository = new ProductRepository(ddbClient, productsDdb)

function sendProductEvent(product: Product, eventType: ProductEventType, email: string, lambdaRequestId: string) {
    const event: ProductEvent = {
        email,
        eventType,
        productCode: product.code,
        productId: product.id,
        productPrice: product.price,
        requestId: lambdaRequestId
    }

    return lambdaClient.invoke({
        FunctionName: productsEventsFunctionName,
        Payload: JSON.stringify(event),
        // InvocationType: 'ResquestResponse' // sync
        InvocationType: 'Event' // async
    }).promise()
}

export async function handler(event: APIGatewayProxyEvent, context: Context): Promise<APIGatewayProxyResult> {

    const { resource, httpMethod, requestContext, pathParameters, body } = event

    const lambdaRequestId = context.awsRequestId

    const apiRequestId = requestContext.requestId

    console.log(`API GATEWAY REQUESTID: ${apiRequestId} - LAMBDA REQUESTID: ${lambdaRequestId}`)

    if(resource === '/products') {
        console.log('POST /products')

        const product = JSON.parse(body!) as Product

        const productCreated = await productRepository.create(product)

        const response = await sendProductEvent(productCreated, ProductEventType.CREATED, 'guilherme@email.com', lambdaRequestId)
        console.log(response)

        return {
            statusCode: 201,
            body: JSON.stringify(productCreated)
        }
    } else if(resource === '/products/{id}') {
        const productId = pathParameters!.id as string

        if(httpMethod === 'PUT') {
            console.log(`PUT /products/${productId}`)

            const product = JSON.parse(body!) as Product

            try {
                const productUpdated = await productRepository.updateProduct(productId, product)

                const response = await sendProductEvent(productUpdated, ProductEventType.UPDATED, 'guilherme@email.com', lambdaRequestId)
                console.log(response)

                return {
                    statusCode: 200,
                    body: JSON.stringify(productUpdated)
                }
            } catch(ConditionalCheckFailedException) {
                console.error((<Error>ConditionalCheckFailedException).message)
                return {
                    statusCode: 404,
                    body: 'Product not found'
                }
            }
        } else if(httpMethod === 'DELETE') {
            console.log(`DELETE /products/${productId}`)

            try {
                const product = await productRepository.deleteProduct(productId)

                const response = await sendProductEvent(product, ProductEventType.DELETED, 'guilherme@email.com', lambdaRequestId)
                console.log(response)

                return {
                    statusCode: 200,
                    body: JSON.stringify(product)
                }
            } catch(err) {
                console.error((<Error>err).message)
                return {
                    statusCode: 404,
                    body: (<Error>err).message
                }
            }
        }
    }

    return {
        statusCode: 400,
        body: JSON.stringify({
            message: 'Bad Request'
        })
    }

}