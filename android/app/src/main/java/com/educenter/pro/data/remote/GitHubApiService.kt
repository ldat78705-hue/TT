package com.educenter.pro.data.remote

import com.google.gson.annotations.SerializedName

/**
 * GitHub Release API response model
 */
data class GitHubRelease(
    @SerializedName("tag_name") val tagName: String,
    @SerializedName("name") val name: String,
    @SerializedName("body") val body: String?,
    @SerializedName("published_at") val publishedAt: String?,
    @SerializedName("assets") val assets: List<GitHubAsset>
)

data class GitHubAsset(
    @SerializedName("name") val name: String,
    @SerializedName("browser_download_url") val downloadUrl: String,
    @SerializedName("size") val size: Long
)

/**
 * Retrofit interface for GitHub Releases API (no auth needed for public repos)
 */
interface GitHubApiService {
    @retrofit2.http.GET("repos/{owner}/{repo}/releases/latest")
    suspend fun getLatestRelease(
        @retrofit2.http.Path("owner") owner: String,
        @retrofit2.http.Path("repo") repo: String
    ): GitHubRelease
}
