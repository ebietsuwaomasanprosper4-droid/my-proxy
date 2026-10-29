const http = require('http');
const net = require('net');
const url = require('url');

const PORT = process.env.PORT || 8080;
const AUTH_USER = 'pprime';
const AUTH_PASS = 'Pprime';

const server = http.createServer((req, res) => {
    if (!checkAuth(req, res)) return;

    const parsedUrl = url.parse(req.url);
    const options = {
        hostname: parsedUrl.hostname,
        port: parsedUrl.port || 80,
        path: parsedUrl.path,
        method: req.method,
        headers: req.headers
    };

    const proxyReq = http.request(options, (proxyRes) => {
        res.writeHead(proxyRes.statusCode, proxyRes.headers);
        proxyRes.pipe(res, { end: true });
    });

    proxyReq.on('error', (err) => {
        res.writeHead(500, { 'Content-Type': 'text/plain' });
        res.end('Proxy Error: ' + err.message);
    });

    req.pipe(proxyReq, { end: true });
});

server.on('connect', (req, clientSocket, head) => {
    if (!checkAuthForConnect(req, clientSocket)) return;

    const { port, hostname } = url.parse(`http://${req.url}`);
    const serverSocket = net.connect(port || 443, hostname, () => {
        clientSocket.write('HTTP/1.1 200 Connection Established\r\n\r\n');
        serverSocket.write(head);
        serverSocket.pipe(clientSocket);
        clientSocket.pipe(serverSocket);
    });

    serverSocket.on('error', () => {
        clientSocket.end();
    });
});

function checkAuth(req, res) {
    const auth = req.headers['proxy-authorization'];
    if (!auth || !verify(auth)) {
        res.writeHead(407, { 'Proxy-Authenticate': 'Basic realm="Proxy"' });
        res.end('Authentication Required');
        return false;
    }
    return true;
}

function checkAuthForConnect(req, clientSocket) {
    const auth = req.headers['proxy-authorization'];
    if (!auth || !verify(auth)) {
        clientSocket.write('HTTP/1.1 407 Proxy Authentication Required\r\nProxy-Authenticate: Basic realm="Proxy"\r\n\r\n');
        clientSocket.end();
        return false;
    }
    return true;
}

function verify(authHeader) {
    try {
        const b64Auth = authHeader.split(' ')[1];
        const [user, pass] = Buffer.from(b64Auth, 'base64').toString().split(':');
        return user === AUTH_USER && pass === AUTH_PASS;
    } catch {
        return false;
    }
}

server.listen(PORT, () => {
    console.log(`Custom proxy server running on port ${PORT}`);
});
