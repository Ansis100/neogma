import { NeogmaError } from './NeogmaError';

/** General constraint error */
export class NeogmaNotFoundError extends NeogmaError {
    public message: NeogmaError['message'];
    public data: object;

    constructor(
        message: NeogmaNotFoundError['message'],
        data?: NeogmaNotFoundError['data'],
    ) {
        super(message, data);
        this.message = message || 'neogma not found error';
        this.data = data;

        Object.setPrototypeOf(this, NeogmaError.prototype);
    }
}