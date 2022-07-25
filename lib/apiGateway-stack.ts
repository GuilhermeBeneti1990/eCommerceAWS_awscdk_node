import * as lambdaNodeJS from "aws-cdk-lib/aws-lambda-nodejs"
import * as cdk from "aws-cdk-lib"
import * as apigateway from "aws-cdk-lib/aws-apigateway"
import * as cwlogs from "aws-cdk-lib/aws-logs"
import { Construct } from "constructs"

interface ECommerceApiStackProps extends cdk.StackProps {
    productsFetchHandler: lambdaNodeJS.NodejsFunction
    productsAdminHandler: lambdaNodeJS.NodejsFunction
    ordersHandler: lambdaNodeJS.NodejsFunction
}

export class ApiGatewayAppStack extends cdk.Stack {
    private createProductsService(props: ECommerceApiStackProps, api: apigateway.RestApi) {
        const productsFetchIntegration = new apigateway.LambdaIntegration(props.productsFetchHandler)
        const productsAdminIntegration = new apigateway.LambdaIntegration(props.productsAdminHandler)

        const productsResource = api.root.addResource("products")
        const productIdResource = productsResource.addResource("{id}")

        //[GET] /products
        productsResource.addMethod("GET", productsFetchIntegration)

        //[GET] /products/{id}
        productIdResource.addMethod("GET", productsFetchIntegration)

        //[POST] /products
        productsResource.addMethod("POST", productsAdminIntegration)

        //[PUT] /products/{id}
        productIdResource.addMethod("PUT", productsAdminIntegration)

        //[DELETE] /products/{id}
        productIdResource.addMethod("DELETE", productsAdminIntegration)
    }

    private createOrdersService(props: ECommerceApiStackProps, api: apigateway.RestApi) {
        const ordersIntegration = new apigateway.LambdaIntegration(props.ordersHandler)

        const ordersResource = api.root.addResource("orders")

        // [GET] /orders
        // [GET] /orders?email=guilherme@email.com
        // [GET] /orders?email=guilherme@email.com&orderId=123
        ordersResource.addMethod("GET", ordersIntegration)

        // [POST] /orders
        ordersResource.addMethod("POST", ordersIntegration)

        // [DELETE] /orders?email=guilherme@email.com&orderId=123
        const orderDeleteValidator = new apigateway.RequestValidator(this, 'OrderDeleteValidator', {
            restApi: api,
            requestValidatorName: 'OrderDeleteValidator',
            validateRequestParameters: true
        })
        
        ordersResource.addMethod("DELETE", ordersIntegration, {
            requestParameters: {
                'method.request.querystring.email': true,
                'method.request.querystring.orderId': true
            },
            requestValidator: orderDeleteValidator
        })
    }

    constructor(scope: Construct, id: string, props: ECommerceApiStackProps) {
        super(scope, id, props)

        const logGroup = new cwlogs.LogGroup(this, "APIGatewayLogs")

        // gateway creation
        const api = new apigateway.RestApi(this, "ApiGateway", {
            restApiName: "ApiGateway",
            deployOptions: {
                accessLogDestination: new apigateway.LogGroupLogDestination(logGroup),
                accessLogFormat: apigateway.AccessLogFormat.jsonWithStandardFields({
                    httpMethod: true,
                    ip: true,
                    protocol: true,
                    requestTime: true,
                    resourcePath: true,
                    responseLength: true,
                    status: true,
                    caller: true,
                    user: true
                })
            }
        })

        this.createProductsService(props, api)
        this.createOrdersService(props, api)
    }
}