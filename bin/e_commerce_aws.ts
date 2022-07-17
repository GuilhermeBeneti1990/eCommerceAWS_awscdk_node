#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { ProductsAppStack } from '../lib/productsApp-stack'
import { ApiGatewayAppStack } from '../lib/apiGateway-stack'
import { ProductsAppLayersStack } from '../lib/productsAppLayers.stack';
import { EventsDdbStack } from '../lib/eventsDdb-stack';

const app = new cdk.App();

//Put your amazon environment credentials here
const env: cdk.Environment = {
    account: "ACCOUNT_CODE",
    region: "ACCOUNT_REGION"
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

const apiGatewayAppStack = new ApiGatewayAppStack(app, "EcommerceApi", {
    productsFetchHandler: productsAppStack.productsFetchHandler,
    productsAdminHandler: productsAppStack.productsAdminHandler,
    tags,
    env
})

apiGatewayAppStack.addDependency(productsAppStack)