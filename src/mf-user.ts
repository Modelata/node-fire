import { IMFUserInterface } from './interfaces/mf-user.interface';
import { MFModel } from './mf-model';
import { AuthUserProperty } from './decorators/auth-user-property.decorator';

export abstract class MFUserModel<M> extends MFModel<M> implements IMFUserInterface {
  @AuthUserProperty()
  email?: string;
  @AuthUserProperty()
  phoneNumber?: string;
  @AuthUserProperty()
  photoUrl?: string;
}
