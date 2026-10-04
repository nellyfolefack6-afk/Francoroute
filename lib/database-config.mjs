import * as tls from 'node:tls';
import {X509Certificate} from 'node:crypto';
import {SUPABASE_CA_CERT} from './supabase-ca.mjs';

// The build and server functions must use the same verified TLS connection.
export function databaseConnectionOptions(env = process.env) {
  let url;
  try {
    url = new URL(env.DATABASE_URL);
    if (!['postgres:', 'postgresql:'].includes(url.protocol) || !url.hostname ||
        /YOUR-PASSWORD/i.test(decodeURIComponent(url.password))) throw new Error();
  } catch { throw Object.assign(new Error('DATABASE_URL_INVALID'), {code: 'DATABASE_URL_INVALID'}); }
  for (const key of ['sslmode', 'sslcert', 'sslkey', 'sslrootcert', 'ssl', 'uselibpqcompat']) url.searchParams.delete(key);
  const ssl = {rejectUnauthorized: true};
  // Supabase uses the verified public CA shipped with this project. The old
  // multiline Netlify variable is deliberately unused for these hosts.
  // Other providers still require a valid custom CA when one is configured.
  const isSupabase = /^(?:[a-z0-9-]+\.pooler\.supabase\.com|db\.[a-z0-9]+\.supabase\.co)$/.test(url.hostname);
  const configuredCA = isSupabase ? SUPABASE_CA_CERT : env.DATABASE_CA_CERT;
  if (configuredCA?.trim()) {
    const pem = configuredCA.replace(/\\n/g, '\n').trim();
    const certificates = pem.match(/-----BEGIN CERTIFICATE-----[\s\S]*?-----END CERTIFICATE-----/g) || [];
    try {
      if (!certificates.length || pem.replace(/-----BEGIN CERTIFICATE-----[\s\S]*?-----END CERTIFICATE-----/g, '').trim()) throw new Error();
      certificates.forEach(certificate => new X509Certificate(certificate));
    } catch { throw Object.assign(new Error('DATABASE_CA_CERT_INVALID'), {code: 'DATABASE_CA_CERT_INVALID'}); }
    // A custom `ca` replaces Node's trust store. Append the Supabase CA so
    // publicly signed pooler certificates remain trusted as well.
    ssl.ca = [...(tls.getCACertificates ? tls.getCACertificates('default') : tls.rootCertificates), ...certificates];
  }
  return {connectionString: url.toString(), ssl};
}

// Static messages only: never print a provider error containing credentials.
export function databaseFailure(error) {
  const messages = {
    DATABASE_URL_INVALID: 'DATABASE_URL est incomplète ou invalide. Recopier l’URI du pooler et remplacer le mot de passe provisoire.',
    DATABASE_CA_CERT_INVALID: 'DATABASE_CA_CERT est incomplet. Recopier le certificat PEM entier, sans guillemets.',
    '28P01': 'Le mot de passe de la base est refusé. Vérifier le mot de passe et son encodage dans DATABASE_URL.',
    '28000': 'La connexion à la base est refusée. Vérifier l’utilisateur et le projet dans DATABASE_URL.',
    '42501': 'Le compte de la base ne dispose pas des droits nécessaires.',
    '42P01': 'Les tables ne sont pas encore préparées. Vérifier le déploiement de production.',
    '3D000': 'Le nom de la base dans DATABASE_URL est incorrect.',
    ENOTFOUND: 'Le serveur de la base est introuvable. Vérifier l’adresse du pooler dans DATABASE_URL.',
    EAI_AGAIN: 'Le serveur de la base ne peut pas être résolu pour le moment.',
    ECONNREFUSED: 'La base refuse la connexion réseau. Vérifier son état et le port du pooler.',
    ETIMEDOUT: 'La connexion à la base a expiré. Vérifier son état et l’adresse du pooler.',
    SELF_SIGNED_CERT_IN_CHAIN: 'Le certificat du serveur de base n’est pas reconnu. Vérifier DATABASE_CA_CERT.',
    DEPTH_ZERO_SELF_SIGNED_CERT: 'Le certificat du serveur de base n’est pas reconnu. Vérifier DATABASE_CA_CERT.',
    UNABLE_TO_VERIFY_LEAF_SIGNATURE: 'La chaîne du certificat de la base est incomplète. Vérifier DATABASE_CA_CERT.',
    UNABLE_TO_GET_ISSUER_CERT_LOCALLY: 'L’autorité du certificat de la base est introuvable. Vérifier DATABASE_CA_CERT.',
    CERT_HAS_EXPIRED: 'Le certificat de la base a expiré.',
    ERR_TLS_CERT_ALTNAME_INVALID: 'Le certificat ne correspond pas au serveur indiqué dans DATABASE_URL.',
  };
  return messages[error?.code] || 'Échec du service. Vérifier la configuration de la base (Production, Builds et Functions).';
}
