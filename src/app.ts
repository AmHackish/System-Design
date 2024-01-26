import dotenv from 'dotenv';
import { SchedulingAlgorithm } from './constants';
import { LoadBalancer } from './lbServer';

dotenv.config();
const port = 3000;

export class App {
    public lbServer:any;

    constructor() {
        this.initializeApp();
    }

    initializeApp() {
        
        this.lbServer = new LoadBalancer(port, SchedulingAlgorithm.ROUND_ROBIN, 10000);
    }
}

const app = new App();