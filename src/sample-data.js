globalThis.PaintasterSampleCollection = {
  "info": {
    "name": "Paintaster Demo Shop API",
    "schema": "https://schema.getpostman.com/json/collection/v2.1.0/collection.json",
    "version": "0.1.0"
  },
  "auth": {
    "type": "bearer"
  },
  "item": [
    {
      "name": "Auth",
      "item": [
        {
          "name": "Create Session",
          "request": {
            "method": "POST",
            "auth": {
              "type": "noauth"
            },
            "header": [
              {
                "key": "Content-Type",
                "value": "application/json"
              }
            ],
            "url": {
              "raw": "{{baseUrl}}/api/session",
              "path": ["api", "session"]
            },
            "body": {
              "mode": "raw",
              "raw": "{\"email\":\"analyst@example.test\",\"password\":\"demo-password\"}"
            }
          }
        },
        {
          "name": "Password Reset",
          "request": {
            "method": "POST",
            "auth": {
              "type": "noauth"
            },
            "header": [
              {
                "key": "Content-Type",
                "value": "application/json"
              }
            ],
            "url": {
              "raw": "{{baseUrl}}/api/users/reset-password",
              "path": ["api", "users", "reset-password"]
            },
            "body": {
              "mode": "raw",
              "raw": "{\"email\":\"analyst@example.test\",\"redirectUrl\":\"https://callback.example.test/reset\"}"
            }
          }
        }
      ]
    },
    {
      "name": "Users",
      "item": [
        {
          "name": "List Users",
          "request": {
            "method": "GET",
            "header": [
              {
                "key": "Authorization",
                "value": "Bearer {{token}}"
              }
            ],
            "url": {
              "raw": "{{baseUrl}}/api/users?role=customer",
              "path": ["api", "users"],
              "query": [
                {
                  "key": "role",
                  "value": "customer"
                }
              ]
            }
          }
        },
        {
          "name": "Get User",
          "request": {
            "method": "GET",
            "header": [
              {
                "key": "Authorization",
                "value": "Bearer {{token}}"
              }
            ],
            "url": {
              "raw": "{{baseUrl}}/api/users/{{userId}}",
              "path": ["api", "users", "{{userId}}"]
            }
          }
        },
        {
          "name": "Update User",
          "request": {
            "method": "PATCH",
            "header": [
              {
                "key": "Authorization",
                "value": "Bearer {{token}}"
              }
            ],
            "url": {
              "raw": "{{baseUrl}}/api/users/{{userId}}",
              "path": ["api", "users", "{{userId}}"]
            },
            "body": {
              "mode": "raw",
              "raw": "{\"displayName\":\"Analyst\",\"role\":\"admin\",\"status\":\"active\",\"callbackUrl\":\"https://callback.example.test/profile\",\"avatarUrl\":\"https://cdn.example.test/avatar.png\",\"marketingOptIn\":true,\"tenantId\":\"tenant-a\",\"notes\":\"lab fixture\"}"
            }
          }
        }
      ]
    },
    {
      "name": "Orders",
      "item": [
        {
          "name": "List Orders",
          "request": {
            "method": "GET",
            "header": [
              {
                "key": "Authorization",
                "value": "Bearer {{token}}"
              }
            ],
            "url": {
              "raw": "{{baseUrl}}/api/orders",
              "path": ["api", "orders"]
            }
          }
        },
        {
          "name": "Get Order",
          "request": {
            "method": "GET",
            "auth": {
              "type": "noauth"
            },
            "url": {
              "raw": "{{baseUrl}}/api/orders/{{orderId}}",
              "path": ["api", "orders", "{{orderId}}"]
            }
          }
        },
        {
          "name": "Delete Order",
          "request": {
            "method": "DELETE",
            "auth": {
              "type": "noauth"
            },
            "url": {
              "raw": "{{baseUrl}}/api/orders/{{orderId}}",
              "path": ["api", "orders", "{{orderId}}"]
            }
          }
        }
      ]
    },
    {
      "name": "Imports",
      "item": [
        {
          "name": "Upload Invoice",
          "request": {
            "method": "POST",
            "header": [
              {
                "key": "Authorization",
                "value": "Bearer {{token}}"
              }
            ],
            "url": {
              "raw": "{{baseUrl}}/api/billing/invoices/upload",
              "path": ["api", "billing", "invoices", "upload"]
            },
            "body": {
              "mode": "formdata",
              "formdata": [
                {
                  "key": "file",
                  "type": "file"
                },
                {
                  "key": "accountId",
                  "value": "acct-test"
                }
              ]
            }
          }
        },
        {
          "name": "Register Webhook",
          "request": {
            "method": "POST",
            "header": [
              {
                "key": "Authorization",
                "value": "Bearer {{token}}"
              },
              {
                "key": "Content-Type",
                "value": "application/json"
              }
            ],
            "url": {
              "raw": "{{baseUrl}}/api/webhooks",
              "path": ["api", "webhooks"]
            },
            "body": {
              "mode": "raw",
              "raw": "{\"targetUrl\":\"https://callback.example.test/hook\",\"secret\":\"lab-secret\",\"events\":[\"invoice.created\"]}"
            }
          }
        }
      ]
    }
  ]
};
