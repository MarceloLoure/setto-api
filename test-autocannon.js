// test-autocannon.js
const autocannon = require('autocannon');

const JWT_TOKEN = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIyOWVjNTQ1Ni0xNDA5LTRiMjgtODFhOS03MGZjMzNhMGEyZWUiLCJlbWFpbCI6ImFkbWluQGJlYWNoc29jaWFsY2x1Yi5jb20iLCJyb2xlIjoiU1VQRVJBRE1JTiIsImlhdCI6MTc4Njc2MTQ3MSwiZXhwIjoxNzg3MzY2MjcxfQ.lDuAQ822xqWXC2CqGGGsArYc6pnf1DFaLqy9GpUg17w';

const instance = autocannon(
  {
    url: 'http://localhost:3000/bookings',
    connections: 20, // 20 conexões simultâneas
    duration: 10,    // por 10 segundos
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${JWT_TOKEN}`,
    },
    body: JSON.stringify({
      courtId: '18629cbc-b094-4b2e-a032-f0ebba95f9c1',
      startTime: '2026-08-25T14:00:00.000Z',
      endTime: '2026-08-25T15:00:00.000Z',
    }),
  },
  (err, result) => {
    if (err) console.error(err);
    else console.log(result);
  },
);

autocannon.track(instance, { renderProgressBar: true });