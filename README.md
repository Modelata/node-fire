# @modelata/node-fire

This library is a wrapper around firestore to implement kind of an ODM in Node.JS projects. It also can be used in Firestore cloud functions projects.

## Installation

```bash
npm i -s @modelata/node-fire firebase-admin reflect-metadata
```

## Initialization

### Init firebase-admin (cf their own documentation)

```javascript
import * as admin from 'firebase-admin';

const serviceAccount = require('./serviceAccount.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: `https://${serviceAccount.project_id}.firebaseio.com`,
  storageBucket: `${serviceAccount.project_id}.appspot.com`,
});

const settings = { timestampsInSnapshots: true };
const db = admin.firestore();
db.settings(settings);

const auth = admin.auth();

const storage = admin.storage().bucket();
```

### Models

#### Basic

Your models must extend MFModel :

```javascript
export class SomeModel extends MFModel<SomeModel> {
  name: string = null;

  constructor(
    data: Partial<SomeModel> = {},
    mustachePath?: string,
    location?: Partial<IMFLocation>,
  ) {
    super();
    super.initialize(data, mustachePath, location);
  }
}
```

#### Extended

You can use decorators on properties to extend your models :

  @InSubDoc(subDocumentPath) => this property is from a subdocument

  @AuthUserProperty() =>

  @StorageProperty(options) => this properties links to a file stored in storage

### DAOs

To manipulate your models in database, you need to create the corresponding DAOs :

Simple :

```javascript
@CollectionPath('somes')
export class SomeDao extends MFDao<SomeModel> {
  constructor(database: FirebaseFirestore.Firestore) {
    super(database);
  }

  getNewModel(data?: Partial<SomeModel>, location?: Partial<IMFLocation>): SomeModel {
    return new SomeModel(data, this.mustachePath, location);
  }
}
```

Flattable if your model is made of data from subdocuments :
```javascript
@CollectionPath('somes')
export class SomeDao extends MFFlattableDao<SomeModel> {
  constructor(db: FirebaseFirestore.Firestore) {
    super(db);
  }

  getNewModel(data?: Partial<SomeModel>, location?: Partial<IMFLocation>): SomeModel {
    const someModel = new SomeModel(data, this.mustachePath, location);
    return someModel;
  }
}
```

### User

User Model must implement IMFUserInterface if you want to reference auth user propertties

```javascript
export class UserModel extends MFModel<UserModel> implements IMFUserInterface {
  @InSubDoc('data/private')
  @AuthUserProperty()
  email: string = null;

  @InSubDoc('data/private')
  @AuthUserProperty()
  phoneNumber: string = null;

  @InSubDoc('data/public')
  @AuthUserProperty()
  photoUrl: string = null;

  @AuthUserProperty()
  displayName: string = null;

  constructor(data: Partial<UserModel>, mustachePath: string, location: Partial<IMFLocation>) {
    super();
    super.initialize(data, mustachePath, location);
  }
}
```

## Usage

Once everything is properly configured you can use standard methods like create, update, delete, get, getList to interact with  database.
Every async method is based on promises.

## Api documentation

You can find more informations on https://moventes.github.io/modelata-node-fire/globals.html
