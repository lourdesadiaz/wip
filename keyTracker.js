const robot = require('robotjs');
const WebSocket = require('ws');

const VTS_URL = "ws://0.0.0.0:8001";  // Dirección de tu WebSocket
const pluginName = "key tracker plugin";
const pluginDeveloper = "@MimiCatVT";

let authenticationToken = "";
let authenticated = false;
let customParameterName = "KT_KeyPress_A";

const ws = new WebSocket(VTS_URL);

ws.on('open', () => {
    console.log(`Conectado a VTube Studio con el plugin "${pluginName}"`);

    // Solicitar el token de autenticación
    const tokenRequest = {
        apiName: "VTubeStudioPublicAPI",
        apiVersion: "1.0",
        requestID: "SomeID",
        messageType: "AuthenticationTokenRequest",
        data: {
            pluginName: pluginName,
            pluginDeveloper: pluginDeveloper,
            pluginIcon: ""
        }
    };

    ws.send(JSON.stringify(tokenRequest));
});

ws.on('message', (data) => {
    const response = JSON.parse(data);

    if (response.messageType === "AuthenticationTokenResponse") {
        if (response.data.authenticationToken) {
            authenticationToken = response.data.authenticationToken;
            console.log("Token recibido:", authenticationToken);
            const authRequest = {
                apiName: "VTubeStudioPublicAPI",
                apiVersion: "1.0",
                requestID: "SomeID",
                messageType: "AuthenticationRequest",
                data: {
                    pluginName: pluginName,
                    pluginDeveloper: pluginDeveloper,
                    authenticationToken: authenticationToken
                }
            };
            ws.send(JSON.stringify(authRequest));
        } else {
            console.error("Error al generar el token:", response.data.message);
        }
    } else if (response.messageType === "AuthenticationResponse") {
        if (response.data.authenticated) {
            authenticated = true;
            console.log("Autenticación exitosa.");
            createCustomParameter();
        } else {
            console.error("Error: Autenticación fallida.");
        }
    } else if (response.messageType === "ParameterCreationResponse") {
        console.log(`Parámetro "${customParameterName}" creado con éxito.`);
        // Iniciar monitoreo de la tecla A después de la autenticación y la creación del parámetro
        startKeyMonitoring();
    } else if (response.messageType === "InjectParameterDataRequest") {
        const parameterData = response.data.parameterValues[0];
        if (parameterData.id === customParameterName) {
            console.log("Estado del parámetro:", parameterData.value);
        }
    } else {
        console.log(`Mensaje recibido: ${data}`);
    }
});

ws.on('error', (error) => {
    console.error("Error al conectarse:", error);
});

function createCustomParameter() {
    const parameterCreationRequest = {
        apiName: "VTubeStudioPublicAPI",
        apiVersion: "1.0",
        requestID: "CreateParam",
        messageType: "ParameterCreationRequest",
        data: {
            parameterName: customParameterName,
            explanation: "Indica si la tecla A está siendo presionada.",
            min: 0,
            max: 1,
            defaultValue: 0
        }
    };

    ws.send(JSON.stringify(parameterCreationRequest));
}

// Función que maneja el monitoreo de la tecla A
function startKeyMonitoring() {
    let lastKeyState = 0;  // Estado previo de la tecla (0 = no presionada, 1 = presionada)

    // Monitoreo de la tecla "A" con robotjs
    setInterval(() => {
        const keyState = robot.keyToggle('a', 'down') ? 1 : 0;  // Verifica si la tecla A está presionada

        // Si el estado de la tecla ha cambiado (de presionada a no presionada o viceversa),
        // solo actualizamos el parámetro una vez cuando la tecla cambia de estado
        if (keyState !== lastKeyState) {
            updateParameterFromVTubeStudio(keyState);  // Actualizamos el parámetro
            lastKeyState = keyState;  // Actualizamos el estado previo
        }
    }, 100);  // Intervalo de monitoreo (100ms)
}

function updateParameterFromVTubeStudio(isKeyActive) {
    // Si la tecla está presionada, enviamos un valor 1, si no, enviamos 0
    const updateRequest = {
        apiName: "VTubeStudioPublicAPI",
        apiVersion: "1.0",
        requestID: "UpdateParam",
        messageType: "InjectParameterDataRequest",
        data: {
            parameterValues: [
                {
                    id: customParameterName,
                    value: isKeyActive ? 1 : 0  // Establece 1 si la tecla está presionada, 0 si no
                }
            ]
        }
    };

    ws.send(JSON.stringify(updateRequest));
    console.log(
        `Actualización enviada: ${customParameterName} = ${isKeyActive ? 1 : 0}`
    );
}

