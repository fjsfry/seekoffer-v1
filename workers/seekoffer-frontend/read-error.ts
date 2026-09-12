import {ApiError} from '../seekoffer-api/src/auth';
// Only controlled categories cross the public boundary; never SQL, credentials or raw causes.
export function publicReadError(error:unknown):ApiError {
 if(error instanceof ApiError)return error;
 const chain:string[]=[];let item:unknown=error;
 for(let i=0;i<4&&item&&typeof item==='object';i++){
  const value=item as {message?:unknown;cause?:unknown};if(typeof value.message==='string')chain.push(value.message);item=value.cause;
 }
 const text=chain.join(' ');
 if(/daily.*limit|quota.*exceed|exceed.*quota|read.*limit.*exceed/i.test(text))return new ApiError(402,'PUBLIC_READ_QUOTA_EXCEEDED');
 if(/PREVIEW_WRITE_VIOLATION/.test(text))return new ApiError(503,'PUBLIC_READ_ONLY_GUARD');
 if(/PREVIEW_SQL_SCOPE|PREVIEW_SQL_READ_ONLY/.test(text))return new ApiError(503,'PUBLIC_QUERY_SCOPE_INVALID');
 if(/D1.*(?:binding|not found)|no such table|no such column/i.test(text))return new ApiError(503,'PUBLIC_DATABASE_CONFIGURATION');
 if(/malformed JSON|JSON.*invalid/i.test(text))return new ApiError(503,'PUBLIC_PROJECTION_INVALID');
 if(/meta|rows_read|rows_written|results/i.test(text)&&error instanceof TypeError)return new ApiError(503,'PUBLIC_DATABASE_RESPONSE_INVALID');
 if(/cache/i.test(text))return new ApiError(503,'PUBLIC_CACHE_UNAVAILABLE');
 if(/D1_ERROR|SQLITE|database/i.test(text))return new ApiError(503,'PUBLIC_DATABASE_READ_FAILED');
 return new ApiError(503,error instanceof TypeError?'PUBLIC_READ_TYPE_ERROR':'PUBLIC_READ_UNAVAILABLE');
}
