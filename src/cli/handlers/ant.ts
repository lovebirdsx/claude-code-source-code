export async function logHandler(a: any): Promise<void> {
    throw new Error('Log handler is not supported in this environment.');
}

export async function errorHandler(a: any): Promise<void> {
    throw new Error('Error handler is not supported in this environment.');
}

export async function exportHandler(a: any, b: any): Promise<void> {
    throw new Error('Export handler is not supported in this environment.');
}

export async function taskCreateHandler(a: any, b: any): Promise<any> {
    throw new Error('Task create handler is not supported in this environment.');
}

export async function taskListHandler(a: any): Promise<any> {
    throw new Error('Task list handler is not supported in this environment.');
}

export async function taskGetHandler(a: any, b: any): Promise<any> {
    throw new Error('Task get handler is not supported in this environment.');
}

export async function taskUpdateHandler(a: any, b: any): Promise<any> {
    throw new Error('Task update handler is not supported in this environment.');
}

export async function taskDirHandler(a: any): Promise<any> {
    throw new Error('Task dir handler is not supported in this environment.');
}

export async function completionHandler(a: any, b: any, c: any): Promise<any> {
    throw new Error('Completion handler is not supported in this environment.');
}