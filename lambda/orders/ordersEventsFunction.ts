import { Context, SNSEvent, SNSMessage } from "aws-lambda"
import { AWSError, DynamoDB } from "aws-sdk"
import { PromiseResult } from "aws-sdk/lib/request"
import * as awsXRAY from "aws-xray-sdk"
import { OrderEvent, OrderEventMessage } from "/opt/nodejs/ordersEventsLayer"
import { OrderEventDdb, OrderEventRepository } from "/opt/nodejs/ordersEventsRepositoryLayer"

awsXRAY.captureAWS(require("aws-sdk"))

const eventsDdb = process.env.EVENTS_DDB!
const ddbClient = new DynamoDB.DocumentClient()
const orderEventsRepository = new OrderEventRepository(ddbClient, eventsDdb)

function createEvent(body: SNSMessage) {
    const orderEventsMessage = JSON.parse(body.Message) as OrderEventMessage
    const event = orderEventsMessage.data as OrderEvent

    console.log(`Order event - MessageId: ${body.MessageId}`)

    const timestamp = Date.now()
    const ttl = ~~(timestamp / 1000 + 5 * 60)

    const orderEventDdb: OrderEventDdb = {
        pk: `#order_${event.orderId}`,
        sk: `${orderEventsMessage.eventType}${timestamp}}`,
        ttl,
        email: event.email,
        createdAt: timestamp,
        requestId: event.requestId,
        eventType: orderEventsMessage.eventType,
        info: {
            orderId: event.orderId,
            productCodes: event.productCodes,
            messageId: body.MessageId
        }
    }

    return orderEventsRepository.createOrderEvent(orderEventDdb)
}

export async function handler(event: SNSEvent, context: Context): Promise<void> {
    const promises: Promise<PromiseResult<DynamoDB.DocumentClient.PutItemOutput, AWSError>>[] = []
    event.Records.forEach(record => {
        promises.push(createEvent(record.Sns))
    })

    await Promise.all(promises)

    return 
}