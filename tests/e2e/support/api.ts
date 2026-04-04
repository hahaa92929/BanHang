import { APIRequestContext, expect } from '@playwright/test';

const apiUrl = process.env.E2E_API_URL ?? 'http://127.0.0.1:4000/api/v1';

type AuthPayload = {
  accessToken: string;
  refreshToken: string;
};

type ReservationResponse = {
  id: string;
};

type OrderResponse = {
  id: string;
  orderNumber?: string;
};

async function parseJson<T>(response: Awaited<ReturnType<APIRequestContext['get']>>) {
  const body = await response.text();
  return body ? (JSON.parse(body) as T) : (null as T);
}

async function expectOk<T>(response: Awaited<ReturnType<APIRequestContext['get']>>) {
  const body = await response.text();
  expect(response.ok(), body || response.statusText()).toBeTruthy();
  return body ? (JSON.parse(body) as T) : (null as T);
}

export async function loginByApi(
  request: APIRequestContext,
  email: string,
  password: string,
): Promise<AuthPayload> {
  const response = await request.post(`${apiUrl}/auth/login`, {
    data: { email, password },
  });

  return expectOk<AuthPayload>(response);
}

export async function createSeededOrder(request: APIRequestContext) {
  const auth = await loginByApi(request, 'customer@banhang.local', 'customer12345');
  const headers = {
    Authorization: `Bearer ${auth.accessToken}`,
  };

  const currentReservation = await request.get(`${apiUrl}/orders/reservations/current`, {
    headers,
  });
  const currentReservationBody = await parseJson<{ data: { id: string } | null }>(currentReservation);
  if (currentReservationBody?.data?.id) {
    const cancelResponse = await request.post(
      `${apiUrl}/orders/reservations/${currentReservationBody.data.id}/cancel`,
      { headers },
    );
    await expectOk<{ success: boolean }>(cancelResponse);
  }

  const clearCartResponse = await request.delete(`${apiUrl}/cart/clear`, {
    headers,
  });
  await expectOk(clearCartResponse);

  const productsResponse = await request.get(`${apiUrl}/products?limit=1`);
  const productsBody = await expectOk<{ data: Array<{ id: string }> }>(productsResponse);
  const productId = productsBody.data[0]?.id;
  expect(productId).toBeTruthy();

  const addCartResponse = await request.post(`${apiUrl}/cart/items`, {
    headers,
    data: {
      productId,
      quantity: 1,
    },
  });
  await expectOk(addCartResponse);

  const reservationResponse = await request.post(`${apiUrl}/orders/reservations`, {
    headers,
  });
  const reservation = await expectOk<ReservationResponse>(reservationResponse);

  const orderResponse = await request.post(`${apiUrl}/orders/checkout`, {
    headers,
    data: {
      reservationId: reservation.id,
      address: {
        receiverName: 'Customer Demo',
        phone: '0900000000',
        district: 'Quan 1',
        addressLine: '123 Nguyen Trai',
        province: 'Ho Chi Minh',
        country: 'Viet Nam',
      },
      paymentMethod: 'cod',
      shippingMethod: 'standard',
      notes: 'E2E order',
    },
  });

  return expectOk<OrderResponse>(orderResponse);
}
