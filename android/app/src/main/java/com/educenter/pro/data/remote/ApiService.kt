package com.educenter.pro.data.remote

import com.educenter.pro.data.model.AppData
import retrofit2.http.Body
import retrofit2.http.GET
import retrofit2.http.POST

data class LoginRequest(val identifier: String, val password: String)
data class LoginResponse(val token: String?, val user: Any?, val role: String?, val error: String?)

data class OperationPayload(val op: String, val payload: Any)
data class BaseResponse(val success: Boolean?, val error: String?)

interface ApiService {
    @POST("api/auth")
    suspend fun login(@Body request: LoginRequest): LoginResponse

    @GET("api/data")
    suspend fun getAppData(): AppData

    @POST("api/data")
    suspend fun executeOperation(@Body operation: OperationPayload): AppData
}
