import express from 'express';
import { IncomingMessage, Server, ServerResponse } from "http";
import { HealthStatus, SchedulingAlgorithm } from './constants';
import { BackendServer } from './b_server';
import axios from 'axios';

const ports = ["8081", "8082", "8083"];

export class LoadBalancer {
    private port:number;
    private algo:any
    server:Server<typeof IncomingMessage, typeof ServerResponse>;
    index = 0;
    healthyServer = new Array<BackendServer>();
    backendServer = new Array<BackendServer>();
    helathCheckPeriod: number = 0;
    private healthCheckTimer!: NodeJS.Timer;
    private controller: AbortController;

    constructor(port:number, algo:any, healthCheckPeriod:number) {
        this.port = port;
        this.algo = algo;
        this.helathCheckPeriod = healthCheckPeriod;
        this.controller = new AbortController();
        // start the backend Server
        this.initializeBackendServer();

        // start the load balancer server 
        const app = express();
        app.use(express.text());
        app.use(express.json());

        // listen request 
        app.get('/', async (req, res) => {
            console.log("Handle requesr");
            this.handleRequest(req, res);
        });
        this.server = app.listen(port, () => {
            console.log(`Hello From load Balancer Server listening at port ${this.port}`);
        });

        // check the health of server
        this.startHealthCheck();
    }
    
    getServer():Server<typeof IncomingMessage, typeof ServerResponse> {
        return this.server;
    }

    closeServer(): void {
        if(this.server) {
            this.server.close();
            this.closeHealthCheck();
        }
    }

    async handleRequest(req:any, res:any) {
        const backendServer = this.getBackendServer();
        console.log("......",this.healthyServer.length);
        if(this.healthyServer.length === 0) {
            res.sendStatus(500);
        } 
        else if(backendServer) {
            this.index = (this.index + 1)%this.healthyServer.length;
            let url = backendServer.url;
            console.log(url);
            try {
                const response = await axios.get(url);

                backendServer.incrementCount();
                res.status(200).send(response.data);
            } catch (err) {
                console.log('err while procesing this request');
                res.sendStatus(500);
            }
        }
    }

    getBackendServer() {
        switch(this.algo) {
            case SchedulingAlgorithm.ROUND_ROBIN :
                return this.healthyServer[this.index % this.healthyServer.length];
            break;
        }
    }

    initializeBackendServer() {
        ports.forEach((port) => {
            let server = new BackendServer(port, this.controller);
            this.backendServer.push(server);
        })
    }

    startHealthCheck() {
        console.log("Start Health Check of All Server!!")
        this.healthCheckTimer = setInterval(async () => {
            await this.performHealthCheck()
        }, this.helathCheckPeriod);
        
    }

    public async performHealthCheck():Promise<void> {
        console.log("Perform Health Check")
        const tasks: Promise<number>[] = [];
        this.backendServer.forEach((server) => {
            const response = server.ping();
            tasks.push(response);
        });

        await Promise.all(tasks).then((val) => {
            for(let i=0; i<val.length; i++) {
                if(val[i] == 200) {
                    this.backendServer[i].setStatus(HealthStatus.HEALTHY);
                    if(this.healthyServer.map(server => server.url).indexOf(this.backendServer[i].url) < 0) {
                        this.healthyServer.push(this.backendServer[i]);
                        this.backendServer[i].resetCount();
                    }
                }
                else {
                    this.backendServer[i].setStatus(HealthStatus.UNHEALTHY);
                    this.healthyServer.filter((server) => {
                        return server.url != this.backendServer[i].url;
                    })
                }
            }
        });

        console.log(`Total Backend Server online ${this.healthyServer.length}`);
    }

    closeHealthCheck():void {
        //clearInterval(this.healthCheckTimer);
    }
}
