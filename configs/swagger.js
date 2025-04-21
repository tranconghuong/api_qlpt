const swaggerJsdoc = require("swagger-jsdoc");

const options = {
    swaggerDefinition: {
      openapi: "3.0.1", // YOU NEED THIS
      info: {
        title: "Ez Hostel",
        version: "1.0.0",
      },
      components: {
        securitySchemes: {
          JWT: {
            type: "apiKey",
            in: "header",
            name: "Authorization",
          },
        },
      },
      security: [
        {
          JWT: [],
        },
      ],
    },
    apis: ["./routes/*.js"],
  };
  
const openapiSpecification = swaggerJsdoc(options);
module.exports = openapiSpecification;