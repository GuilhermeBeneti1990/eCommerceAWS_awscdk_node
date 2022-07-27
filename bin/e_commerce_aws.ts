#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { ProductsAppStack } from '../lib/productsApp-stack'
import { ApiGatewayAppStack } from '../lib/apiGateway-stack'
import { ProductsAppLayersStack } from '../lib/productsAppLayers.stack';
import { EventsDdbStack } from '../lib/eventsDdb-stack';
import { OrdersAppLayersStack } from '../lib/ordersAppLayers-stack';
import { OrdersAppStack } from '../lib/ordersApp-stack';

const app = new cdk.App();

//Put your amazon environment credentials here
const env: cdk.Environment = {
    account: "ACCOUNT_ID",
    region: "REGION"
}

const tags = {
    cost: "ECommerce",
    team: "BenetiCode"
}

const productsAppLayersStack = new ProductsAppLayersStack(app, "ProductsAppLayers", {
    tags,
    env
})

const eventsDdbStack = new EventsDdbStack(app, "EventsDdb", {
    tags,
    env
})

const productsAppStack = new ProductsAppStack(app, "ProductsApp", {
    eventsDdb: eventsDdbStack.table,
    tags,
    env
})
productsAppStack.addDependency(productsAppLayersStack)
productsAppStack.addDependency(eventsDdbStack)

const ordersAppLayersStack = new OrdersAppLayersStack(app, 'OrdersAppLayers', {
    tags,
    env
})

const ordersAppStack = new OrdersAppStack(app, 'OrdersApp', {
    tags,
    env,
    productsDdb: productsAppStack.productsDdb,
    eventsDdb: eventsDdbStack.table
})

ordersAppStack.addDependency(productsAppStack)
ordersAppStack.addDependency(ordersAppLayersStack)
ordersAppStack.addDependency(eventsDdbStack)

const apiGatewayAppStack = new ApiGatewayAppStack(app, "ApiGatewayApp", {
    productsFetchHandler: productsAppStack.productsFetchHandler,
    productsAdminHandler: productsAppStack.productsAdminHandler,
    ordersHandler: ordersAppStack.ordersHandler,
    tags,
    env
})

apiGatewayAppStack.addDependency(productsAppStack)
apiGatewayAppStack.addDependency(ordersAppStack)