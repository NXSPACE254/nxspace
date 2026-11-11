import { LocalIdentityRepository, hashPassword } from "../repositories/identity-repository.js";

const SESSION_KEY="nxspace.beta.v1.admin-session", SESSION_DURATION=60*60*1000;
const safeParse=(value)=>{try{return JSON.parse(value)}catch{return null}};

export class LocalAuthenticationAdapter {
  constructor({storage=localStorage,sessionStorageAdapter=sessionStorage,identityRepository}={}){this.storage=storage;this.sessionStorage=sessionStorageAdapter;this.identity=identityRepository||new LocalIdentityRepository({storage})}
  hasCredential(){return this.identity.listUsers().length>0}
  async createDemoAccount({username,password}){if(this.hasCredential())throw new Error("本機管理帳號已存在。");await this.identity.createUser({username,password,displayName:"NXSPACE Demo Admin",email:"",phone:"",roleIds:["role-super-admin"],status:"active"},"setup");return this.login({username,password})}
  async login({username,password}){const user=this.identity.getByUsername(username);if(!user||user.status!=="active"||await hashPassword(password,user.passwordSalt)!==user.passwordHash){this.identity.audit("login.failure",String(username||"anonymous"),"anonymous");throw new Error("帳號或密碼不正確，或帳號目前不可登入。")}const now=Date.now();const session={id:crypto.randomUUID(),userId:user.id,username:user.username,displayName:user.displayName,roleIds:user.roleIds,sessionVersion:user.sessionVersion||1,issuedAt:now,expiresAt:now+SESSION_DURATION};this.sessionStorage.setItem(SESSION_KEY,JSON.stringify(session));this.identity.recordLogin(user.id);this.identity.audit("login.success",user.id,user.id);return session}
  getSession(){const session=safeParse(this.sessionStorage.getItem(SESSION_KEY));if(!session||session.expiresAt<=Date.now()){this.logout();return null}const user=this.identity.getUser(session.userId);if(!user||user.status!=="active"||user.sessionVersion!==session.sessionVersion){this.logout();return null}return{...session,user}}
  refreshSession(){const session=this.getSession();if(!session)return null;const refreshed={...session,expiresAt:Date.now()+SESSION_DURATION};delete refreshed.user;this.sessionStorage.setItem(SESSION_KEY,JSON.stringify(refreshed));return refreshed}
  logout(){const session=safeParse(this.sessionStorage.getItem(SESSION_KEY));if(session)this.identity.audit("logout",session.userId,session.userId);this.sessionStorage.removeItem(SESSION_KEY)}
}
let auth;export function getAuthenticationService(){auth||=new LocalAuthenticationAdapter();return auth}
