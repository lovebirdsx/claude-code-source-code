export function writeServerLock(a: any) {

}

export function removeServerLock() {

}

export async function probeRunningServer(): Promise<any> {
    throw new Error('Probing for running server is not supported in this environment.');
}
