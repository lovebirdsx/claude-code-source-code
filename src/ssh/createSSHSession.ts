export function createSSHSession(a: any, b: any) {
    throw new Error('SSH sessions are not supported in this environment.');
}

export function createLocalSSHSession(a: any) {
    throw new Error('Local SSH sessions are not supported in this environment.');
}

export class SSHSessionError extends Error {}