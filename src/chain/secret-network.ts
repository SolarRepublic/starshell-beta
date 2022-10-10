import {
	QueryContractsByCodeDesc,
	QueryContractInfoDesc,
	QueryClientImpl as ComputeQueryClient,
	CodeInfoResponse,
	ContractInfoWithAddress,
} from '@solar-republic/cosmos-grpc/dist/secret/compute/v1beta1/query'
import { CosmosNetwork } from "./cosmos-network";

export class SecretNetwork extends CosmosNetwork {
	async codeInfo(si_code: `${bigint}`): Promise<CodeInfoResponse | undefined> {
		return (await new ComputeQueryClient(this._y_grpc).code({
			codeId: si_code,
		})).codeInfo;
	}

	async contractsByCode(si_code: `${bigint}`): Promise<ContractInfoWithAddress[]> {
		const g_response = await new ComputeQueryClient(this._y_grpc).contractsByCode({
			codeId: si_code,
		});

		return g_response.contractInfos;
	}
}
