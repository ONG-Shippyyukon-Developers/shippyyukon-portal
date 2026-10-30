#!/usr/bin/env node
import "source-map-support/register";
import * as cdk from "aws-cdk-lib";
import { ShippiyyukonStack } from "../lib/shippiyyukon-stack";

const app = new cdk.App();

// Lista de municipios piloto: PLACEHOLDER de ejemplo (5 de los 25 reales).
// RawData §12, Pregunta Abierta 6, sigue abierta — reemplazar `context.
// municipiosPiloto` en cdk.json con el listado real confirmado por
// Shippiyyukon antes de desplegar a staging/prod.
const municipiosPiloto: string[] = app.node.tryGetContext("municipiosPiloto") ?? [];

const envName = app.node.tryGetContext("envName") ?? "dev";

new ShippiyyukonStack(app, `ShippiyyukonStack-${envName}`, {
  envName,
  municipiosPiloto,
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: process.env.CDK_DEFAULT_REGION ?? "us-east-1",
  },
  description: `Portal Red Alianza y Fraternidad — ambiente ${envName}`,
});
