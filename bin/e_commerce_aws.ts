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
//account: "243626255914",
//region: "us-east-1"
const env: cdk.Environment = {
    account: "243626255914",
    region: "us-east-1"
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
    productsDdb: productsAppStack.productsDdb
})

ordersAppStack.addDependency(productsAppStack)
ordersAppStack.addDependency(ordersAppLayersStack)

const apiGatewayAppStack = new ApiGatewayAppStack(app, "ApiGatewayApp", {
    productsFetchHandler: productsAppStack.productsFetchHandler,
    productsAdminHandler: productsAppStack.productsAdminHandler,
    ordersHandler: ordersAppStack.ordersHandler,
    tags,
    env
})

apiGatewayAppStack.addDependency(productsAppStack)
apiGatewayAppStack.addDependency(ordersAppStack)