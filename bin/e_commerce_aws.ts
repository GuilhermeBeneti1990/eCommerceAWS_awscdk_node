#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { ProductsAppStack } from '../lib/productsApp-stack'
import { ECommerceApiStack } from '../lib/ecommerceApi-stack'
import { ProductsAppLayersStack } from '../lib/productsAppLayers.stack';

const app = new cdk.App();

//Put your amazon environment credentials here
const env: cdk.Environment = {
    account: "ACCOUNT_ID",
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

const productsAppStack = new ProductsAppStack(app, "ProductsApp", {
    tags,
    env
})
productsAppStack.addDependency(productsAppLayersStack)

const ecommerceApiStack = new ECommerceApiStack(app, "EcommerceApi", {
    productsFetchHandler: productsAppStack.productsFetchHandler,
    productsAdminHandler: productsAppStack.productsAdminHandler,
    tags,
    env
})

ecommerceApiStack.addDependency(productsAppStack)