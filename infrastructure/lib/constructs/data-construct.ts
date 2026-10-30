import { Construct } from "constructs";
import * as ec2 from "aws-cdk-lib/aws-ec2";
import * as rds from "aws-cdk-lib/aws-rds";
import * as kms from "aws-cdk-lib/aws-kms";
import { Duration, RemovalPolicy } from "aws-cdk-lib";

/**
 * DAT §5 (Multitenencia) y §6 (Cifrado): una AWS KMS Customer Managed Key por
 * municipio piloto, y un clúster Aurora Serverless v2 Postgres compartido
 * (esquema separado por municipio a nivel de aplicación — ver schema.sql).
 *
 * NOTA DE ALCANCE: este starter aprovisiona la CMK por municipio (aislamiento
 * de cifrado real) pero el aislamiento de ESQUEMA por municipio dentro de
 * Aurora se gestiona en las migraciones de la aplicación (services/api/src/db),
 * no aquí. Antes de producción, confirmar con el DAT §5 si se necesita además
 * separar por cluster/instancia cuando el volumen lo justifique.
 */
export class DataConstruct extends Construct {
  public readonly vpc: ec2.Vpc;
  public readonly cluster: rds.DatabaseCluster;
  public readonly municipioKeys: Record<string, kms.Key>;
  public readonly dbSecurityGroup: ec2.SecurityGroup;

  constructor(
    scope: Construct,
    id: string,
    props: { envName: string; municipiosPiloto: string[] }
  ) {
    super(scope, id);

    this.vpc = new ec2.Vpc(this, "Vpc", {
      maxAzs: 2,
      natGateways: props.envName === "prod" ? 2 : 1,
      subnetConfiguration: [
        { name: "public", subnetType: ec2.SubnetType.PUBLIC, cidrMask: 24 },
        {
          name: "private-app",
          subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS,
          cidrMask: 24,
        },
        {
          name: "private-data",
          subnetType: ec2.SubnetType.PRIVATE_ISOLATED,
          cidrMask: 24,
        },
      ],
    });

    // RawData Riesgo 3 / DAT §5 — una CMK por municipio piloto.
    this.municipioKeys = {};
    for (const municipio of props.municipiosPiloto) {
      this.municipioKeys[municipio] = new kms.Key(this, `Cmk-${municipio}`, {
        alias: `shippiyyukon/${props.envName}/${municipio}`,
        description: `CMK dedicada al municipio ${municipio} (aislamiento de tenant)`,
        enableKeyRotation: true, // rotación anual automática — RawData §8
        removalPolicy:
          props.envName === "prod" ? RemovalPolicy.RETAIN : RemovalPolicy.DESTROY,
      });
    }

    const dbSecurityGroup = new ec2.SecurityGroup(this, "DbSecurityGroup", {
      vpc: this.vpc,
      description: "Acceso a Aurora solo desde la capa de aplicación (Lambda/Fargate)",
      allowAllOutbound: false,
    });

    // Llave "general" del clúster (metadatos, no datos Nivel 3-4 de un
    // municipio específico); los campos sensibles se cifran además a nivel de
    // aplicación con la CMK del municipio correspondiente (ver services/api).
    const clusterKey = new kms.Key(this, "ClusterKey", {
      alias: `shippiyyukon/${props.envName}/cluster`,
      enableKeyRotation: true,
    });

    this.cluster = new rds.DatabaseCluster(this, "AuroraCluster", {
      engine: rds.DatabaseClusterEngine.auroraPostgres({
        version: rds.AuroraPostgresEngineVersion.VER_16_4,
      }),
      vpc: this.vpc,
      vpcSubnets: { subnetType: ec2.SubnetType.PRIVATE_ISOLATED },
      securityGroups: [dbSecurityGroup],
      storageEncryptionKey: clusterKey,
      defaultDatabaseName: "shippiyyukon",
      serverlessV2MinCapacity: props.envName === "prod" ? 0.5 : 0, // 0 = autopausa en dev/staging
      serverlessV2MaxCapacity: props.envName === "prod" ? 4 : 1,
      writer: rds.ClusterInstance.serverlessV2("Writer"),
      readers:
        props.envName === "prod" ? [rds.ClusterInstance.serverlessV2("Reader")] : [],
      backup: { retention: Duration.days(props.envName === "prod" ? 14 : 7) },
      removalPolicy:
        props.envName === "prod" ? RemovalPolicy.RETAIN : RemovalPolicy.DESTROY,
    });

    this.dbSecurityGroup = dbSecurityGroup;
  }
}
