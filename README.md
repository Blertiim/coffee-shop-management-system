# coffee-shop-management-system

## Tablet Access

For tablet/phone testing on the same Wi-Fi:

1. Start the backend on port `5000`.
2. Start the frontend normally.
3. Open the frontend from the laptop IP, for example:
   `http://192.168.0.12:5173`

The frontend is configured to resolve the API automatically to:
`http://<current-device-hostname>:5000/api`

So if the tablet opens `http://192.168.0.12:5173`, API calls will go to:
`http://192.168.0.12:5000/api`
