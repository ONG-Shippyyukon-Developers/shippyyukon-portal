import { Construct } from "constructs";
import { Stack, StackProps, CfnOutput } from "aws-cdk-lib";
import { AuthConstruct } from "./constructs/auth-construct";
import { DataConstruct } from "./constructs/data-construct";
import { StorageConstruct } from "./constructs/storage-construct";
import { ApiConstruct } from "./constructs/api-construct";

export interface ShippiyyukonStackProps extends StackProps {
  envName: string; // dev | staging | prod — DAT §11
  municipiosPiloto: string[];
}

/**
 * Stack de la Épica 0 (fundamento) + lo que la Épica A necesita para
 * funcionar de extremo a extremo. Las construcciones de la Épica B
 * (autorizaciones de viaje) se añaden en una fase posterior sobre esta
 * misma base (ver Backlog, Épica B — todavía no construida).
 */
export class ShippiyyukonStack extends Stack {
  constructor(scope: Construct, id: string, props: ShippiyyukonStackProps) {
    super(scope, id, props);

    const auth = new AuthConstruct(this, "Auth", { envName: props.envName });

    const data = new DataConstruct(this, "Data", {
      envName: props.envName,
      municipiosPiloto: props.municipiosPiloto,
    });

    // La CMK "general" para el bucket de expedientes (Épica B, aún no
    // construida) usa por ahora la llave del primer municipio como placeholder
    // de patrón; cuando se construya la Épica B, cada expediente debe cifrarse
    // con la CMK de SU municipio específico (DAT §5), no con una llave única.
    const storage = new StorageConstruct(this, "Storage", {
      envName: props.envName,
      bucketKey: Object.values(data.municipioKeys)[0],
    });

    const api = new ApiConstruct(this, "Api", {
      envName: props.envName,
      vpc: data.vpc,
      dbSecurityGroup: data.dbSecurityGroup,
      cluster: data.cluster,
      userPool: auth.userPool,
      userPoolClient: auth.userPoolClient,
    });

    new CfnOutput(this, "ApiUrl", { value: api.httpApi.apiEndpoint });
    new CfnOutput(this, "UserPoolId", { value: auth.userPool.userPoolId });
    new CfnOutput(this, "UserPoolClientId", { value: auth.userPoolClient.userPoolClientId });
    new CfnOutput(this, "DbClusterEndpoint", { value: data.cluster.clusterEndpoint.hostname });
    new CfnOutput(this, "ExpedientesBucketName", { value: storage.expedientesBucket.bucketName });
  }
}
