export type Account = {
  username: string
  href: string
  timestamp?: number
}

export interface FollowDataSource {
  getFollowers(): Promise<Account[]>
  getFollowing(): Promise<Account[]>
}
