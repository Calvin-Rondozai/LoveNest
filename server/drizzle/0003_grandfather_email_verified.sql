-- Accounts created before email OTP was required can keep signing in.
UPDATE `user` SET `email_verified` = 1 WHERE `email_verified` = 0;
