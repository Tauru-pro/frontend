export const environment = {
  production: false,
  apiUrl: 'https://brackend.onrender.com/api/v1',
  cdn: 'https://d29jd8kr1el63j.cloudfront.net',
  cognito: {
    userPoolId: 'us-east-1_MkSNYVlii',
    userPoolClientId: '5n24f952o2ub2j6lku168spfa2',
    oauth: {
      domain: 'dev-ecommerce-mvp-domain.auth.us-east-1.amazoncognito.com',
      redirectSignIn: 'http://localhost:4200/auth/callback',
      redirectSignOut: 'http://localhost:4200',
    },
  },
};
