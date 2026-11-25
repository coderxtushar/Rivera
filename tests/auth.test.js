'use strict';

const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { setup, teardown, api, createUser, lastMail, tokenFromUrl } = require('./helpers');

const cookiesOf = (res) => (res.headers['set-cookie'] || []).map((c) => c.split(';')[0]);
const cookieValue = (res, name) => cookiesOf(res).find((c) => c.startsWith(`${name}=`))?.split('=')[1];

describe('auth', () => {
  before(setup);
  after(teardown);

  const creds = { email: 'Alice@Example.com', password: 'supersecret1', firstName: 'Alice' };

  it('signs up, normalises email, hides password hash, sets cookies', async () => {
    const res = await api().post('/api/v1/auth/signup').send(creds);
    assert.equal(res.status, 201);
    assert.equal(res.body.data.user.email, 'alice@example.com');
    assert.equal(res.body.data.user.role, 'student');
    assert.equal(res.body.data.user.passwordHash, undefined);
    assert.ok(res.body.data.accessToken);
    assert.ok(cookieValue(res, 'rv_access'));
    assert.ok(cookieValue(res, 'rv_refresh'));
    const refreshCookie = res.headers['set-cookie'].find((c) => c.startsWith('rv_refresh='));
    assert.match(refreshCookie, /HttpOnly/);
    assert.match(refreshCookie, /Path=\/api\/v1\/auth/);
  });

  it('rejects duplicate email and invalid input', async () => {
    const dup = await api().post('/api/v1/auth/signup').send(creds);
    assert.equal(dup.status, 409);
    assert.equal(dup.body.error.code, 'EMAIL_TAKEN');

    const bad = await api().post('/api/v1/auth/signup').send({ email: 'nope', password: 'short' });
    assert.equal(bad.status, 400);
    assert.equal(bad.body.error.code, 'VALIDATION_ERROR');
    assert.ok(bad.body.error.details.length >= 2);
  });

  it('ignores attempts to self-assign a role at signup', async () => {
    const res = await api().post('/api/v1/auth/signup').send({ ...creds, email: 'mallory@example.com', role: 'admin' });
    assert.equal(res.status, 201);
    assert.equal(res.body.data.user.role, 'student');
  });

  it('signs in with the same error for unknown email and wrong password', async () => {
    const wrong = await api().post('/api/v1/auth/signin').send({ email: creds.email, password: 'wrongpass1' });
    const unknown = await api().post('/api/v1/auth/signin').send({ email: 'ghost@example.com', password: 'wrongpass1' });
    assert.equal(wrong.status, 401);
    assert.equal(unknown.status, 401);
    assert.equal(wrong.body.error.message, unknown.body.error.message);

    const ok = await api().post('/api/v1/auth/signin').send({ email: creds.email, password: creds.password });
    assert.equal(ok.status, 200);
  });

  it('authenticates with bearer token and with cookie', async () => {
    const signin = await api().post('/api/v1/auth/signin').send(creds);
    const bearer = await api().get('/api/v1/auth/me').set('Authorization', `Bearer ${signin.body.data.accessToken}`);
    assert.equal(bearer.status, 200);
    assert.equal(bearer.body.data.user.email, 'alice@example.com');

    const cookie = await api().get('/api/v1/auth/me').set('Cookie', cookiesOf(signin));
    assert.equal(cookie.status, 200);

    const none = await api().get('/api/v1/auth/me');
    assert.equal(none.status, 401);
    const garbage = await api().get('/api/v1/auth/me').set('Authorization', 'Bearer abc.def.ghi');
    assert.equal(garbage.body.error.code, 'TOKEN_INVALID');
  });

  it('rotates refresh tokens and revokes the family on reuse', async () => {
    const signin = await api().post('/api/v1/auth/signin').send(creds);
    const first = cookieValue(signin, 'rv_refresh');

    const r1 = await api().post('/api/v1/auth/refresh').send({ refreshToken: first });
    assert.equal(r1.status, 200);
    const second = cookieValue(r1, 'rv_refresh');
    assert.notEqual(first, second);

    // Replaying the old token = theft signal → whole family revoked.
    const replay = await api().post('/api/v1/auth/refresh').send({ refreshToken: first });
    assert.equal(replay.status, 401);
    assert.equal(replay.body.error.code, 'REFRESH_TOKEN_REUSED');

    const afterTheft = await api().post('/api/v1/auth/refresh').send({ refreshToken: second });
    assert.equal(afterTheft.status, 401);
  });

  it('signout revokes the refresh token', async () => {
    const signin = await api().post('/api/v1/auth/signin').send(creds);
    const out = await api().post('/api/v1/auth/signout').set('Cookie', cookiesOf(signin));
    assert.equal(out.status, 204);
    const again = await api().post('/api/v1/auth/refresh').send({ refreshToken: cookieValue(signin, 'rv_refresh') });
    assert.equal(again.status, 401);
  });

  it('verifies email with a single-use token', async () => {
    const mail = lastMail('verifyEmail');
    assert.ok(mail, 'verification email sent');
    const token = tokenFromUrl(mail.data.url);
    const res = await api().post('/api/v1/auth/verify-email').send({ token });
    assert.equal(res.status, 200);
    assert.equal(res.body.data.user.isEmailVerified, true);
    const reuse = await api().post('/api/v1/auth/verify-email').send({ token });
    assert.equal(reuse.status, 400);
  });

  it('resets a forgotten password and kills existing sessions', async () => {
    const signin = await api().post('/api/v1/auth/signin').send(creds);
    const oldRefresh = cookieValue(signin, 'rv_refresh');

    const unknown = await api().post('/api/v1/auth/forgot-password').send({ email: 'ghost@example.com' });
    const known = await api().post('/api/v1/auth/forgot-password').send({ email: creds.email });
    assert.equal(unknown.status, 200);
    assert.deepEqual(unknown.body, known.body);

    const token = tokenFromUrl(lastMail('resetPassword').data.url);
    const reset = await api().post('/api/v1/auth/reset-password').send({ token, password: 'brandnewpass1' });
    assert.equal(reset.status, 200);

    assert.equal((await api().post('/api/v1/auth/refresh').send({ refreshToken: oldRefresh })).status, 401);
    // Access tokens issued before the change are rejected too.
    const stale = await api().get('/api/v1/auth/me').set('Authorization', `Bearer ${signin.body.data.accessToken}`);
    assert.equal(stale.status, 401);
    assert.equal(stale.body.error.code, 'TOKEN_REVOKED');
    assert.equal((await api().post('/api/v1/auth/signin').send({ ...creds, password: 'brandnewpass1' })).status, 200);
    creds.password = 'brandnewpass1';
  });

  it('changes password with the current one and keeps this session', async () => {
    const signin = await api().post('/api/v1/auth/signin').send(creds);
    const auth = { Authorization: `Bearer ${signin.body.data.accessToken}` };
    const wrong = await api().post('/api/v1/auth/change-password').set(auth).send({ currentPassword: 'nope', newPassword: 'anotherpass1' });
    assert.equal(wrong.status, 400);
    const ok = await api().post('/api/v1/auth/change-password').set(auth).send({ currentPassword: creds.password, newPassword: 'anotherpass1' });
    assert.equal(ok.status, 200);
    const me = await api().get('/api/v1/auth/me').set('Authorization', `Bearer ${ok.body.data.accessToken}`);
    assert.equal(me.status, 200);
    const old = await api().get('/api/v1/auth/me').set(auth);
    assert.equal(old.status, 401);
    creds.password = 'anotherpass1';
  });

  it('signout-all kills outstanding access tokens', async () => {
    const u = await createUser();
    assert.equal((await api().post('/api/v1/auth/signout-all').set(u.auth)).status, 204);
    assert.equal((await api().get('/api/v1/auth/me').set(u.auth)).status, 401);
  });

  it('blocks suspended users immediately', async () => {
    const admin = await createUser({ role: 'admin' });
    const victim = await createUser();
    const res = await api().patch(`/api/v1/admin/users/${victim.user._id}`).set(admin.auth).send({ status: 'suspended' });
    assert.equal(res.status, 200);
    const me = await api().get('/api/v1/auth/me').set(victim.auth);
    assert.equal(me.status, 403);
    assert.equal(me.body.error.code, 'ACCOUNT_SUSPENDED');
  });

  it('blocks cross-site cookie requests (CSRF) but allows the configured origin', async () => {
    const signin = await api().post('/api/v1/auth/signin').send({ email: creds.email, password: creds.password });
    assert.equal(signin.status, 200);
    const evil = await api().post('/api/v1/auth/signout').set('Cookie', cookiesOf(signin)).set('Origin', 'https://evil.example');
    assert.equal(evil.status, 403);
    assert.equal(evil.body.error.code, 'BAD_ORIGIN');
    const good = await api().post('/api/v1/auth/signout').set('Cookie', cookiesOf(signin)).set('Origin', 'http://localhost:3000');
    assert.equal(good.status, 204);
  });

  it('lets a student become an instructor and returns a fresh token', async () => {
    const s = await createUser();
    const res = await api().post('/api/v1/users/me/become-instructor').set(s.auth).send({ headline: 'I teach things' });
    assert.equal(res.status, 200);
    assert.equal(res.body.data.user.role, 'instructor');
    const create = await api()
      .post('/api/v1/courses')
      .set('Authorization', `Bearer ${res.body.data.accessToken}`)
      .send({ title: 'My first course' });
    assert.equal(create.status, 201);
  });
});
