# WT Booking API

A sample implementation of the WT booking API specification in node.js.

This server is assumed to handle booking requests for a single
hotel. Within this scope, it:

- validates booking requests against hotel data in WT (rate plans,
  cancellation policies, available tooms)

- performs the necessary bookkeeping directly in the WT platform
  (i.e. it updates availability data based on accepted booking
   requests)

Note: we do not expect this API implementation to be run in
production "as is"; instead, we assume that it should serve more
as an inspiration or as a basis on which actual integrations
between existing systems and Winding Tree can be built.

Most notably, this implementation misses the actual relay of
booking data to hotel managers as we expect the mechanism of
such a relay to be generally different for different hotels. 

## Requirements
- Nodejs 10.x

## Getting started
In order to install and run tests, we must:
```
git clone git@github.com:windingtree/wt-write-api.git
nvm install
npm install
npm test
```

## Running the server

To run the server, you need to go through the following steps:

1. Make sure you have access to a running instance of [wt-read-api](https://github.com/windingtree/wt-read-api) and
   [wt-write-api](https://github.com/windingtree/wt-write-api).
2. If you do not have one yet, create an account in the write API
   (see the [README](https://github.com/windingtree/wt-write-api) for instructions).
3. If you have not done that yet, register your hotel in WT
   using the write API. Do not forget to upload the rate plans and
   initial availability data.
4. Based on `src/config/dev.js`, prepare a new configuration
   file with the appropriate settings (read/write
   API urls, access keys, hotel ID, etc.). Let's assume you will
   store it as `src/config/prod.js`.
5. Now you can run the server with the newly created
   configuration:

   ```sh
   WT_CONFIG=prod node src/index.js
   ```

## Examples

### Book rooms

To perform a booking, you can send a request like this (just
make sure that the specifics, such as hotel ID or room type IDs,
are correct with respect to your hotel).

```sh
$ curl -X POST localhost:8935/booking -H 'Content-Type: application/json' --data '
{
  "hotelId": "0xe92a8f9a7264695f4aed8d1f397dbc687ba40299",
  "customer": {
    "name": "Sherlock",
    "surname": "Holmes",
    "address": {
      "line1": "221B Baker Street",
      "city": "London",
      "country": "GB"
    },
    "email": "sherlock.holmes@houndofthebaskervilles.net"
  },
  "pricing": {
    "currency": "GBP",
    "total": 221,
    "cancellationFees": [
      { "from": "2018-12-01", "to": "2019-01-01", "amount": 50 }
    ]
  },
  "booking": {
    "arrival": "2019-01-01",
    "departure": "2019-01-03",
    "rooms": [
      {
        "id": "single-room",
        "guestInfoIds": ["1"]
      },
      {
        "id": "single-room",
        "guestInfoIds": ["2"]
      }
    ],
    "guestInfo": [
      {
        "id": "1",
        "name": "Sherlock",
        "surname": "Holmes"
      },
      {
        "id": "2",
        "name": "John",
        "surname": "Watson"
      }
    ]
  }
}'
```

If everything went well, you should get a response with the
status code "200" and you should see a change in the hotel's
availability data.
