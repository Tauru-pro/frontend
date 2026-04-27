import { environment } from '../../../environments/environment';

export const cognitoConfig = {
  userPoolId: environment.cognito.userPoolId,
  userPoolClientId: environment.cognito.userPoolClientId,
  oauth: environment.cognito.oauth,
};
