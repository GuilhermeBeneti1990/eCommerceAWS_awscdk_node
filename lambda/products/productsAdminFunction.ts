import { APIGatewayProxyEvent, APIGatewayProxyResult, Context } from "aws-lambda";
import { Product, ProductRepository } from "/opt/nodejs/productsLayer";
import { DynamoDB } from "aws-sdk"
import * as awsXRAY from "aws-xray-sdk"

awsXRAY.captureAWS(require("aws-sdk"))

const productsDdb = process.env.PRODUCTS_DDB!
const ddbClient = new DynamoDB.DocumentClient()

const productRepository = new ProductRepository(ddbClient, productsDdb)

export async function handler(event: APIGatewayProxyEvent, context: Context): Promise<APIGatewayProxyResult> {

    const { resource, httpMethod, requestContext, pathParameters, body } = event

    const lambdaRequestId = context.awsRequestId

    const apiRequestId = requestContext.requestId

    console.log(`API GATEWAY REQUESTID: ${apiRequestId} - LAMBDA REQUESTID: ${lambdaRequestId}`)

    if(resource === '/products') {
        console.log('POST /products')

        const product = JSON.parse(body!) as Product

        const productCreated = await productRepository.create(product)

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