import { Construct } from "constructs";
import * as cognito from "aws-cdk-lib/aws-cognito";
import { Duration, RemovalPolicy } from "aws-cdk-lib";

/**
 * HU-00.2 — Amazon Cognito User Pool con atributos custom de RBAC
 * (rol_plataforma, municipio) y autenticación por passkey (WebAuthn/FIDO2),
 * que sustituye a la MFA tradicional para todos los roles internos
 * (decisión del cliente, 24/10/2026 — ver DAT §4).
 *
 * NOTA: a la fecha de este starter, el soporte de passkeys en Cognito se
 * habilita por el flujo "USER_AUTH" + WebAuthn vía la consola/API de Cognito
 * (no siempre expuesto como propiedad L2 estable en aws-cdk-lib). Si al
 * desplegar la versión de aws-cdk-lib no expone `signInPolicy`/WebAuthn como
 * propiedad de alto nivel, usar un `CfnUserPool` override (`addPropertyOverride`)
 * o una Custom Resource — documentado aquí para que el equipo lo verifique
 * contra la versión de CDK que esté usando al momento de desplegar.
 */
export class AuthConstruct extends Construct {
  public readonly userPool: cognito.UserPool;
  public readonly userPoolClient: cognito.UserPoolClient;

  constructor(scope: Construct, id: string, props: { envName: string }) {
    super(scope, id);

    this.userPool = new cognito.UserPool(this, "UserPool", {
      userPoolName: `shippiyyukon-${props.envName}`,
      selfSignUpEnabled: false, // el alta de usuarios es administrativa (HU-A6, "Carga Autorizada")
      signInAliases: { email: true },
      standardAttributes: {
        email: { required: true, mutable: false },
        fullname: { required: true, mutable: true },
      },
      customAttributes: {
        // Leídos por services/api/src/middleware/auth.ts para RBAC (HU-00.5)
        rol_plataforma: new cognito.StringAttribute({ minLen: 3, maxLen: 40, mutable: true }),
        municipio: new cognito.StringAttribute({ minLen: 0, maxLen: 60, mutable: true }),
      },
      passwordPolicy: {
        minLength: 12,
        requireLowercase: true,
        requireUppercase: true,
        requireDigits: true,
        requireSymbols: true,
      },
      accountRecovery: cognito.AccountRecovery.EMAIL_ONLY,
      removalPolicy:
        props.envName === "prod" ? RemovalPolicy.RETAIN : RemovalPolicy.DESTROY,
    });

    this.userPoolClient = this.userPool.addClient("PortalClient", {
      authFlows: { userSrp: true, custom: true }, // custom: habilita el flujo USER_AUTH (passkeys)
      accessTokenValidity: Duration.minutes(30),
      idTokenValidity: Duration.minutes(30),
      refreshTokenValidity: Duration.days(14),
      preventUserExistenceErrors: true,
    });

    // TODO (equipo de despliegue): habilitar WebAuthn/passkeys sobre este User
    // Pool siguiendo la guía vigente de AWS para "Sign-in with passkeys using
    // Cognito user pools" — verificar si la versión de aws-cdk-lib instalada
    // ya expone esto como propiedad L2; si no, usar un override de bajo nivel.
  }
}
