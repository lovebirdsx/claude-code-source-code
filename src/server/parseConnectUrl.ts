export function parseConnectUrl(connectUrl: string): { serverUrl: string, authToken: string } { 
    return {
        serverUrl: connectUrl,
        authToken: '',
    }
}