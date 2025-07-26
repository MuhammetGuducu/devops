import http from 'k6/http';
import { sleep } from 'k6';

export default function () {
  http.get('https://8ttpqyq23e.eu-central-1.awsapprunner.com/health');
  sleep(1);
}