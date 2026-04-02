export default async function sessionUploaderPromise(): Promise<{
    createSessionTurnUploader: (sessionId: string, turnId: string) => any
}> {
    return {
        createSessionTurnUploader: (sessionId: string, turnId: string) => {
            return {}
        }
    }
}

export function createSessionTurnUploader() {
    return {}
}
