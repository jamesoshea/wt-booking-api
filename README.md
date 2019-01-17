# WT Booking API

A sample implementation of the WT booking API specification in node.js.

This server is assumed to handle booking requests for a single
hotel. Within this scope, it:

- Validates booking requests against hotel data in WT (rate plans,
  cancellation policies, available rooms)

- Performs the necessary bookkeeping directly in the WT platform
  (i.e. it updates availability data based on accepted booking
  requests). This implementation does not change availability
  for the date of departure.

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
   Currently, version 0.8.x of wt-read-api is assumed.
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

### Running the server in a hosted docker-based environment

You can use this API as a parametrized docker image in your setup:

- `BASE_URL` - Base URL of this API instance, for example `https://booking-mazurka.windingtree.com`.
- `DB_CLIENT` - [Knex](https://knexjs.org/) database client name, for example `sqlite3`.
- `DB_CLIENT_OPTIONS` - [Knex](https://knexjs.org/) database client options as JSON string, for
example `{"filename": "./envvar.sqlite"}`.
- `READ_API_URL` - URL of [wt-read-api](https://github.com/windingtree/wt-read-api) instance.
- `WRITE_API_URL` - URL of [wt-write-api](https://github.com/windingtree/wt-write-api) instance.
- `SUPPLIER_ID` - On-chain Address of the hotel or airline.
- `WRITE_API_KEY` - Access Key for wt-write-api instance.
- `WALLET_PASSWORD` - Password for an Ethereum wallet associated with used wt-write-api key.
- `LOG_LEVEL` - Set log level for [winston](https://www.npmjs.com/package/winston).

The following options are optional.

#### Checking

- `CHECK_AVAILABILITY` - If false, no restrictions and no room quantity is checked. This may lead
to overbooking. Defaults to true.
- `CHECK_CANCELLATION_FEES` - If false, passed cancellation fees are not validated. This may lead
to conditions unfavourable for a hotel. Defaults to true.
- `CHECK_TOTAL_PRICE` - If false, the price is not validated against ratePlans. This may lead
to conditions unfavourable for a hotel. Defaults to true.
- `DEFAULT_BOOKING_STATE` - This state is assigned to every accepted booking. Can be `confirmed`
or `pending`. Defaults to `confirmed`.
- `WT_SEGMENT` - Choose segment (`hotels`, `airlines`) this instance is intended for. Defaults to `hotels`.

#### Data modification

- `UPDATE_AVAILABILITY` - If false, availability is not updated in data stored in WT platform. This
makes sense with using `DEFAULT_BOOKING_STATE` with `pending` value when you have to process the
booking manually anyway. Defaults to true.
- `ALLOW_CANCELLATION` - If false, booking cancellation is not allowed. Defaults to true.

#### Mailing

- `MAIL_SUPPLIER_CONFIRMATION_SEND` - If true, a summary of each accepted booking is sent to
`MAIL_SUPPLIER_CONFIRMATION_ADDRESS`. Requires configured mailer and that address. Defaults to false.
- `MAIL_CUSTOMER_CONFIRMATION_SEND` - If true, a summary of each accepted booking is sent
to the customer. Requires configured mailer. Defaults to false.
- `MAIL_SUPPLIER_CONFIRMATION_ADDRESS` - E-mail address to which the hotel confirmations will be
sent.
- `MAIL_PROVIDER` - Denotes which mailing provider should be used. Supported values are `dummy`
and `sendgrid`. Defaults to undefined.
- `MAIL_PROVIDER_OPTIONS` - JSON string with options of any given mailing provider. For example
`{"from": "noreply@example.com"}`. See providers implementation for particular options.

For boolean flags, any of '1', '0', 'true', 'false', 'yes', 'no' should work (case insensitive).

**The `CHECK_*` options are good for testing or APIs that actually pass data to humans that are
responsible for data validation. These should never be turned off in fully automated production-like
environment as they may lead to unexpected and inconsistent results.**

```sh
$ docker build -t windingtree/wt-booking-api .
$ docker run -p 8080:8935 \
  -e DB_CLIENT_OPTIONS='{"filename": "./envvar.sqlite"}' \
  -e DB_CLIENT=sqlite3 \
  -e WT_CONFIG=envvar \
  -e NODE_ENV=production \
  -e BASE_URL=https://booking.example.com \
  -e READ_API_URL=https://read-api.example.com \
  -e WRITE_API_URL=https://write-api.example.com \
  -e SUPPLIER_ID=0x123456 \
  -e WRITE_API_KEY=werdfs12 \
  -e WALLET_PASSWORD=windingtree windingtree/wt-booking-api
```
- After that you can access the wt-booking-api on local port `8080`.
Database will also be setup during the container startup in the current setup.
You can skip this with `SKIP_DB_SETUP` environment variable.

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

The [swagger definition](docs/swagger.yaml) for airlines is just a bit different:

```sh
$ curl -X POST localhost:8935/booking -H 'Content-Type: application/json' --data '
{
  "airlineId": "0xe92a8f9a7264695f4aed8d1f397dbc687ba40299",
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
    "flightNumber": "OK0965",
    "flightId": "IeKeix6G",
    "bookingClasses": [
      "bookingClassId": "business",
      "passengers": [
        "name": "John",
        "surname: "Watson",
      ],
    ],
  }
}'
```
