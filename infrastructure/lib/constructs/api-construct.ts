import { Construct } from "constructs";
import * as apigwv2 from "aws-cdk-lib/aws-apigatewayv2";
import { HttpLambdaIntegration } from "aws-cdk-lib/aws-apigatewayv2-integrations";
import { NodejsFunction } from "aws-cdk-lib/aws-lambda-nodejs";
import * as lambda from "aws-cdk-lib/aws-lambda";
import * as ec2 from "aws-cdk-lib/aws-ec2";
import * as rds from "aws-cdk-lib/aws-rds";
import * as cognito from "aws-cdk-lib/aws-cognito";
import { Duration } from "aws-cdk-lib";
import * as path from "path";

/**
 * DAT §4 — API Gateway (HTTP API, más económica que REST API para este
 * volumen) + Lambda (NodejsFunction, bundling automático con esbuild).
 * Expone los endpoints de la Épica A descritos en el Backlog.
 */
export class ApiConstruct extends Construct {
  public readonly httpApi: apigwv2.HttpApi;

  constructor(
    scope: Construct,
    id: string,
    props: {
      envName: string;
      vpc: ec2.Vpc;
      dbSecurityGroup: ec2.SecurityGroup;
      cluster: rds.DatabaseCluster;
      userPool: cognito.UserPool;
      userPoolClient: cognito.UserPoolClient;
    }
  ) {
    super(scope, id);

    const handlersDir = path.join(
      __dirname,
      "..",
      "..",
      "..",
      "services",
      "api",
      "src",
      "handlers"
    );

    const sharedEnv = {
      DB_HOST: props.cluster.clusterEndpoint.hostname,
      DB_PORT: props.cluster.clusterEndpoint.port.toString(),
      DB_NAME: "shippiyyukon",
      COGNITO_USER_POOL_ID: props.userPool.userPoolId,
      COGNITO_CLIENT_ID: props.userPoolClient.userPoolClientId,
      NODE_OPTIONS: "--enable-source-maps",
    };

    const makeFunction = (name: string, entryRelativePath: string) =>
      new NodejsFunction(this, name, {
        entry: path.join(handlersDir, entryRelativePath),
        handler: "handler",
        runtime: lambda.Runtime.NODEJS_20_X,
        memorySize: 256,
        timeout: Duration.seconds(10),
        vpc: props.vpc,
        vpcSubnets: { subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS },
        securityGroups: [props.dbSecurityGroup],
        environment: sharedEnv,
        bundling: { minify: true, sourceMap: true },
      });

    const healthFn = makeFunction("HealthFn", "health.ts");
    const createConsejeroFn = makeFunction("CreateConsejeroFn", "consejeros/create.ts");
    const approveConsejeroFn = makeFunction("ApproveConsejeroFn", "consejeros/approve.ts");
    const listConsejerosFn = makeFunction("ListConsejerosFn", "consejeros/list.ts");

    // Las credenciales de DB se inyectan vía Secrets Manager (el secreto que
    // genera rds.DatabaseCluster), no como variables de entorno en texto plano.
    for (const fn of [createConsejeroFn, approveConsejeroFn, listConsejerosFn]) {
      props.cluster.secret?.grantRead(fn);
      fn.addEnvironment("DB_SECRET_ARN", props.cluster.secret?.secretArn ?? "");
    }

    this.httpApi = new apigwv2.HttpApi(this, "HttpApi", {
      apiName: `shippiyyukon-api-${props.envName}`,
      corsPreflight: {
        allowOrigins: [
          "https://redpanel.shippiyyukon.com",
          "https://red.shippiyyukon.com",
          ...(props.envName !== "prod" ? ["http://localhost:5173"] : []),
        ],
        allowMethods: [apigwv2.CorsHttpMethod.GET, apigwv2.CorsHttpMethod.POST],
        allowHeaders: ["authorization", "content-type"],
      },
    });

    this.httpApi.addRoutes({
      path: "/health",
      methods: [apigwv2.HttpMethod.GET],
      integration: new HttpLambdaIntegration("HealthIntegration", healthFn),
    });
    this.httpApi.addRoutes({
      path: "/consejeros",
      methods: [apigwv2.HttpMethod.POST],
      integration: new HttpLambdaIntegration("CreateConsejeroIntegration", createConsejeroFn),
    });
    this.httpApi.addRoutes({
      path: "/consejeros",
      methods: [apigwv2.HttpMethod.GET],
      integration: new HttpLambdaIntegration("ListConsejerosIntegration", listConsejerosFn),
    });
    this.httpApi.addRoutes({
      path: "/consejeros/{id}/approve",
      methods: [apigwv2.HttpMethod.POST],
      integration: new HttpLambdaIntegration("ApproveConsejeroIntegration", approveConsejeroFn),
    });
  }
}
