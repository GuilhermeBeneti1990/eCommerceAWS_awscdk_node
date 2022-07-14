import { APIGatewayProxyEvent, APIGatewayProxyResult, Context } from "aws-lambda";
import { ProductRepository } from "/opt/nodejs/productsLayer";
import { DynamoDB } from "aws-sdk"
import * as awsXRAY from "aws-xray-sdk"

awsXRAY.captureAWS(require("aws-sdk"))

const productsDdb = process.env.PRODUCTS_DDB!
const ddbClient = new DynamoDB.DocumentClient()

const productRepository = new ProductRepository(ddbClient, productsDdb)

export async function handler(event: APIGatewayProxyEvent, context: Context): Promise<APIGatewayProxyResult> {

    const { resource, httpMethod, requestContext, pathParameters } = event

    const lambdaRequestId = context.awsRequestId

    const apiRequestId = requestContext.requestId

    console.log(`API GATEWAY REQUESTID: ${apiRequestId} - LAMBDA REQUESTID: ${lambdaRequestId}`)

    if(resource === '/products') {
        if(httpMethod === 'GET') {
            console.log('GET /products')

            const products = await productRepository.getAllProducts()

            return {
                statusCode: 200,
                body: JSON.stringify(products)
            }
        }
    } else if(resource === '/products/{id}') {
        const productId = pathParameters!.id as string
        console.log(`GET /products/${productId}`)

        try {
            const product = await productRepository.getProductById(productId)

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

    return {
        statusCode: 400,
        body: JSON.stringify({
            message: 'Bad Request'
        })
    }
}