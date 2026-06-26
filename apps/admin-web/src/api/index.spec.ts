import http from './http';
import { opsUsersApi } from './index';

jest.mock('./http', () => ({
  __esModule: true,
  default: {
    patch: jest.fn(),
  },
}));

describe('opsUsersApi', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('sends newPassword when resetting an ops user password', () => {
    opsUsersApi.resetPassword('user-1', 'CatWallet@0626@');

    expect(http.patch).toHaveBeenCalledWith('/ops-users/user-1/password', {
      newPassword: 'CatWallet@0626@',
    });
  });
});
