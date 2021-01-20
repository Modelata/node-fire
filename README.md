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

```ts
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

### COMMON ATTRIBUTES

modelata-node-fire set some attribute an all models.

- \_id : document id.
- \_collectionPath : document path.
- \_snapshot : document firestore snapshot.
- updateDate : date of last update.
- creationDate : creation date of document in db.
- deleted : boolean used for soft deletion mode

#### Extended

You can use decorators on properties to extend your models :

#### @InsubDoc

```ts
  @InSubDoc('data/private')
  email: string = null;
  ```
  - @param subDocPath the path of the subdocument (WITHOUT main document path)
  
   this property is from a subdocument

 /!\  the DAO must extends MFFlattableDao

#### @AuthUserProperty

```ts
  @AuthUserProperty()
  email: string = null;
```
#### @StorageProperty

```ts
  @StorageProperty({
    deletePreviousOnUpdate: false,
    deleteOnDelete: true
  })
  picture: IMFFile = null;
```

this properties links to a file stored in storage
The property must be of type : IMFFile.


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
#### @CollectionPath decorator

```ts
@CollectionPath('/users')
```

CollectionPath decorator must be used on all DAO.  
CollectionPath take in parameter a string representing the collection path in firestore db.  
If the collection is a subcollection (collection in a document), use the "mustache" syntaxe for all document id.

```ts
@CollectionPath('/users/{userId}/mySubCollection/{mySubDocId}/subSubcollection')
```

All methods that need an id or a location (like "get"), now take a Location with ids mentioned in CollectionPath.

```ts
const location = {
  id: 'mySubSubDocId',
  mySubDocId: 'id',
  userId: 'id',
};
```

#### @DeletionMode decorator

```ts
@DeletionMode(MFDeleteMode.SOFT)
```

DeletionMode decorator is used for set the deletion strategy for this DAO. (default : HARD)
DeletionMode take in parameter a enum value MFDeleteMode.SOFT or MFDeleteMode.HARD.  

MFDeleteMode.SOFT :
- when a dao delete a document (with delete methode), the document is just updated with delete = true;
- all getList calls have a "where filter" on deleted field  

MFDeleteMode.HARD :
- when a dao delete a document (with delete methode), the document is definitely deleted.

### PUBLIC METHOD

#### get

```ts
get(idOrLocation: string | IMFLocation, options?: IMFGetOneOptions)
```

Get a model from database from id or location

- options :

```ts
export interface IMFGetOneOptions {
    /**
     * Document will include an hidden property containing document snapshote
     */
    withSnapshot?: boolean;
    /**
     * Observable returned will complete on first result
     */
    completeOnFirst?: boolean;
    /**
     * Request result will be cached in order to get a faster answer on same getOne request
     */
    cacheable?: boolean;
    /**
     * Display an error in console when requested document not exists (default: true)
     */
    warnOnMissing?: boolean;
}
```
#### getByReference

```ts
getByReference(reference: DocumentReference, options?: IMFGetOneOptions)
```

Get a model from database from its reference

#### getByPath

```ts
getByPath(path: string, options?: IMFGetOneOptions)
```

Get a model from database from its path

#### getList

```ts
getList(location?: MFOmit<IMFLocation, "id">, options?: IMFGetListOptions<M>)
```

Get a list of documents in the collection

- options :

```ts
export interface IMFGetListOptions<M> {
  /**
   * Documents will include an hidden property containing document snapshote
   */
  withSnapshot?: boolean;

  /**
   * Observable returned will complete on first result
   */
  completeOnFirst?: boolean;

  /**
   * Where conditions
   */
  where?: IMFWhere[];

  /**
   * Order by
   */
  orderBy?: IMFOrderBy;

  /**
   * Maximum result returned
   */
  limit?: number;

  /**
   * boundary of the get, only one is applied
   */
  offset?: IMFOffset<M>;

  /**
   * Request result will be cached in order to get a faster answer on same getList request
   */
  cacheable?: boolean;
}
```

#### getReference
```ts
 getReference(idOrLocation: string | Partial<IMFLocation>)
 ```
Get the reference from an id (document only), a location (document or collection) or a model (document only)

#### update

```ts
update(data: Partial<M>, location?: string | IMFLocation | M, options?: IMFUpdateOptions<M>)
```

update some field of a model.

- options :

```ts
/**
 * List of file properties of the model M for which stored files MUST (true) or MUST NOT be deleted on document update
 * (Overrides behaviour configured in model decorators)
 */
export type IMFDeletePreviousOnUpdateFilesOptions<M extends IMFModel<M>> = {
  /**
   * File property : true => the previous file will be deleted if updated
   * File property : false => the fprevious ile will NOT be deleted if updated
   */ [fileAttribute in NonFunctionPropertyNames<M>]?: boolean;
};

/**
 * Options to pass to update method
 */
export interface IMFUpdateOptions<M extends IMFModel<M>> {
  deletePreviousOnUpdateFiles?: IMFDeletePreviousOnUpdateFilesOptions<M>;
}
```
#### create

```ts
create(data: M, location?: string | Partial<IMFLocation>, options?: IMFSaveOptions)
```

save a new model in db, update if already exist.

- options :

```ts
export interface IMFSaveOptions {
  /**
   * If document already exists, it will be fully overwritten
   */
  overwrite?: boolean;
}
```
#### delete

```ts
delete(idLocationOrModel: string | IMFLocation | M, options?: IMFDeleteOptions<M>)
```

Delete a model by id
```ts
/**
 * List of file properties of the model M for which stored files MUST (true) or MUST NOT be deleted on document deletion
 * (Overrides behaviour configured in model decorators)
 */
export declare type IMFDeleteOnDeleteFilesOptions<M extends IMFModel<M>> = {
  /**
   * File property : true => the file will be deleted
   * File property : false => the file will NOT be deleted
   */
  [fileAttribute in NonFunctionPropertyNames<M>]?: boolean;
};

/**
 * Options to pass to delete method
 */
export interface IMFDeleteOptions<M extends IMFModel<M>> {
  deleteOnDeleteFiles?: IMFDeleteOnDeleteFilesOptions<M>;
  cascadeOnDelete?: boolean;
  mode?: MFDeleteMode; // used for override defaultvalue (HARD or @DeletionMode)
}
```
### deleteByReference
```ts
deleteByReference(reference: DocumentReference)
```
Delete a model by its reference

#### getReferenceFromPath

```ts
getReferenceFromPath(path: string)
```

Get a reference from a compatible path

#### getSnapshot

```ts
getSnapshot(idOrLocation: string | IMFLocation, options?: IMFGetOneOptions)
```

#### isCompatible

```ts
isCompatible(modelOrReference: M | DocumentReference | CollectionReference)
```

Check if the model or reference is compatible with this DAO based on its path
### User

User Model must implement IMFUserInterface if you want to reference auth user propertties

```ts
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

## Test
See https://gitlab.com/modelata/test-node-fire