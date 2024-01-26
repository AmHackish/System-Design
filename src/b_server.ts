import axios from "axios";
import express from "express";
import { IncomingMessage, Server, ServerResponse } from "http";
import { HealthStatus } from "./constants";

export interface IBackendServer {
    port:string;
    url:string;
    controller:AbortController;
    server:Server<typeof IncomingMessage, typeof ServerResponse>;
    totalRequest:number;
    getServer() : Server<typeof IncomingMessage, typeof ServerResponse>;
    closeServer() : void
    incrementCount(): void
    getStatus():HealthStatus
    resetCount():void

}
export class BackendServer implements IBackendServer {
    port:string;
    server;
    public url = "http://localhost:";
    totalRequest: number;
    controller:AbortController;
    status:HealthStatus = HealthStatus.UNHEALTHY;

    constructor(port: string, controller: AbortController) {
        this.port = port;
        this.url += port;
        this.totalRequest = 0;
        const app = express();
        this.controller = controller;

        app.get('/', (req, res) => {
            res.status(200).send(`Hello There ${this.port}`);
        })

        app.get('/ping', (req, res) => {
            res.sendStatus(200);
        })

        this.server = app.listen(port, () => {
            console.log(`Backend server listening on port ${this.port}`);
        });
    }

    public getServer(): Server<typeof IncomingMessage, typeof ServerResponse>  {
        return this.server;
    }

    public closeServer() {
        if(this.server)
            this.server.close();
        console.log(`Close Backend Server with port ${this.port}`);
    }

    public incrementCount(): void {
        this.totalRequest++;    
    }
    public setStatus(status:HealthStatus):void {
        this.status = status
    }
    public async ping() :Promise<number> {
        let url = this.url + '/ping';
        console.log("url", url);
        try {
            const response = await axios.get(url, {
                signal: this.controller.signal
            });
            console.log(response.status)
            return response.status;
        } catch(err) {
            console.log("Err during health check")
            return 500;
        }
    }

    public getStatus(): HealthStatus {
        return this.status;
    }

    public resetCount() {
        this.totalRequest = 0;
    }
}