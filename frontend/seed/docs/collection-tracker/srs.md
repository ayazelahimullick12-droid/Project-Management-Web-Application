## Functional requirements {#functional}

- **SR-01:** Store collections on the tablet with the member's photo and GPS location; refuse to save when the location is older than 15 minutes. *(BR-01)*
- **SR-02:** Sync automatically and show the last sync time. *(BR-02)*
- **SR-03:** Branch dashboard of daily totals. *(BR-03)*

## Non-functional requirements {#non_functional}

The app works fully offline and syncs to the Collection Server every 30 minutes when a connection is available. A day's data syncs in under 2 minutes on 3G.

## Hosting and devices {#hosting}

BRAC data centre in Dhaka. Tablets are managed with TabSecure MDM so the app can be updated remotely and wiped if lost.
