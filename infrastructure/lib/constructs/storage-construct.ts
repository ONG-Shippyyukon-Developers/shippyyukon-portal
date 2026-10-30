import { Construct } from "constructs";
import * as s3 from "aws-cdk-lib/aws-s3";
import * as kms from "aws-cdk-lib/aws-kms";
import { RemovalPolicy, Duration } from "aws-cdk-lib";

/**
 * DAT §4 — Amazon S3 con SSE-KMS, versionado y Object Lock para las
 * fotografías y PDFs de autorizaciones (Épica B). Se crea en esta fase
 * (Épica 0) porque es infraestructura base, aunque la Épica B que la
 * consume todavía no se construye — ver Backlog, "Enfoque Actual".
 */
export class StorageConstruct extends Construct {
  public readonly expedientesBucket: s3.Bucket;

  constructor(
    scope: Construct,
    id: string,
    props: { envName: string; bucketKey: kms.Key }
  ) {
    super(scope, id);

    this.expedientesBucket = new s3.Bucket(this, "ExpedientesBucket", {
      bucketName: `shippiyyukon-expedientes-${props.envName}`.toLowerCase(),
      encryption: s3.BucketEncryption.KMS,
      encryptionKey: props.bucketKey,
      bucketKeyEnabled: true,
      versioned: true,
      objectLockEnabled: props.envName === "prod",
      objectLockDefaultRetention:
        props.envName === "prod"
          ? s3.ObjectLockRetention.governance(Duration.days(365))
          : undefined,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      enforceSSL: true,
      removalPolicy:
        props.envName === "prod" ? RemovalPolicy.RETAIN : RemovalPolicy.DESTROY,
      lifecycleRules: [
        {
          id: "transicion-infrecuente",
          transitions: [
            { storageClass: s3.StorageClass.INFREQUENT_ACCESS, transitionAfter: Duration.days(90) },
          ],
        },
      ],
    });
  }
}
