import http from 'k6/http';
import { check, sleep } from 'k6';

const baseUrl = __ENV.BASE_URL || 'http://127.0.0.1:4000/api/v1';

export const options = {
  vus: Number(__ENV.K6_VUS || 5),
  duration: __ENV.K6_DURATION || '20s',
  thresholds: {
    http_req_failed: ['rate<0.01'],
    http_req_duration: ['p(95)<800'],
  },
};

export default function () {
  const health = http.get(`${baseUrl}/health`);
  check(health, {
    'health responds 200': (response) => response.status === 200,
  });

  const products = http.get(`${baseUrl}/products?limit=6`);
  check(products, {
    'products responds 200': (response) => response.status === 200,
    'products payload has data': (response) => {
      const body = JSON.parse(response.body || '{}');
      return Array.isArray(body.data);
    },
  });

  sleep(1);
}
