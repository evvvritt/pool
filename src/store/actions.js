import Web3 from 'web3'
import axios from 'axios'
import utils from 'web3-utils'

import PoolContractArtifacts from '../../pool_contracts/build/contracts/Patron.json'
import ERC20ContractArtifacts from '../../pool_contracts/build/contracts/ERC20.json'
// const BN = web3.utils.BN
import ZeroClientProvider from 'web3-provider-engine/zero.js'
window.deleteIt = function (address) {
  axios.delete('https://api.pool.ac/pools/' + address)
}
let poolContract = null
let baseContract = null

export default {
  initWeb3 ({state, commit, dispatch}) {
    return new Promise((resolve, reject) => {
      // check for aedentity app
      if (global.web3) {
        var web3Provider = global.web3.currentProvider
      } else {
        this.readOnly = true
        web3Provider = ZeroClientProvider({
          getAccounts: function () {},
          // rpcUrl: 'https://mainnet.infura.io',
          // rpcUrl: 'https://testnet.infura.io',
          // rpcUrl: 'https://rinkeby.infura.io'
          rpcUrl: 'https://ropsten.infura.io'
          // rpcUrl: 'https://kovan.infura.io',
        })
      }

      if (web3Provider) {
        global.web3 = new Web3(web3Provider)
        dispatch('startChecking')
      }
    })
  },
  startChecking ({dispatch}) {
    setInterval(() => {
      dispatch('check')
    }, 1000)
  },
  check ({dispatch}) {
    dispatch('checkNetwork')
    dispatch('checkAccount')
  },
  checkNetwork ({state, commit, dispatch}) {
    return global.web3.eth.net.getId((err, netId) => {
      if (err) console.error(err)
      if (!err && state.network !== netId) {
        commit('UPDATE_NETWORK', netId)
        dispatch('getPools')
        dispatch('deployContract')
      }
    })
  },
  checkAccount ({state, commit, dispatch}) {
    return global.web3.eth.getAccounts((error, accounts) => {
      if (error) throw new Error(error)
      if (accounts.length && state.account !== accounts[0]) {
        commit('UPDATE_UNLOCKED', true)
        commit('UPDATE_ACCOUNT', accounts[0])
        dispatch('login')
      } else if (!accounts.length) {
        commit('UPDATE_UNLOCKED', false)
        commit('UPDATE_ACCOUNT', null)
        commit('LOGGED_OUT')
      }
    })
  },
  login ({ state, commit }) {
    return axios.post(apiUrl('/users'), { address: state.account }).then(({ data }) => {
      commit('LOGGED_IN')
    })
  },
  subscribe: async ({state, commit}, joinData) => {
    console.log(joinData)
    console.log(baseContract)
    let balance = await baseContract.methods.balanceOf(state.account).call()
    let allowed = await baseContract.methods.allowance(state.account, state.pool.address).call()
    console.log('base balance', utils.fromWei(balance))
    console.log('base allowed', utils.fromWei(allowed))
    let totalAllowed = utils.toWei(utils.toBN(joinData.amount).toString())
    console.log(totalAllowed)
    totalAllowed = utils.toBN(totalAllowed).mul(utils.toBN(joinData.duration))
    console.log('new allowed amount', utils.fromWei(totalAllowed.toString()))
    console.log(utils.toBN(balance))
    if (!totalAllowed.gt(allowed)) {
      console.log('not enough')
      let tx1 = await baseContract.methods.approve(state.pool.address, totalAllowed).send({from: state.account})
      console.log('tx1', tx1)
    }

    let interval = utils.toBN(1 * 60 * 60 * 24 * 7 * 4)
    let tx2 = await poolContract.methods.subscribe(
      state.account,
      totalAllowed,
      interval,
      utils.toBN(joinData.share)
    ).send({from: state.account, value: utils.toWei('0.0001')})
    console.log('tx2', tx2)
    let newBalance = await baseContract.methods.balanceOf(state.account).call()
    console.log('base newBalance', utils.fromWei(newBalance).toString())
    let newBondBalance = await poolContract.methods.balanceOf(state.account).call()
    console.log('bond newBalance', utils.fromWei(newBondBalance).toString())

    // if (totalAllowed.sub())
    // function subscribe (address patron, uint256 amount, uint256 interval, uint256 percentToPatron) public payable {
  },
  deploy ({state, commit, dispatch}, pool) {
    console.log('DEPLOY')
    console.log(pool)
    console.log(PoolContractArtifacts.abi)
    var contract = new global.web3.eth.Contract(PoolContractArtifacts.abi)
    // this.deploying = true

    let ropstenBaseToken = '0x882ceff101cd49deb83e9b6f4b74473187af2b3b'
    let rinkebyBaseToken = '0x0806ba7d6dabc06a480988205c49e78af265ed57'
    console.log(state.network === 4 ? 'is rinkeby' : 'is not rinkeby')

    let ganache = '0x82d50ad3c1091866e258fd0f1a7cc9674609d254'
    console.log('network', state.network)
    let baseToken = state.network === 4 ? rinkebyBaseToken : (state.network === 5771 ? ganache : ropstenBaseToken)
    console.log(baseToken)
    commit('INC_DEPLOY_STEP', 'two')
    let args = [pool.name, pool.symbol, pool.baseToken === 'DAI' ? baseToken : pool.customBaseTokenAddress, '0', '0', '1000']

    contract.deploy({
      arguments: args,
      data: PoolContractArtifacts.bytecode
    }).estimateGas(function (err, gas) {
      if (err) {
        console.error(err)
      }
      console.log(gas)
      let options = {
        value: utils.toWei('0.00001'),
        from: state.account,
        gas: 3500000, // est: 3452717
        gasPrice: 20000000000
      }

      contract.deploy({
        arguments: args,
        data: PoolContractArtifacts.bytecode
      }).send(options, function (e, hash) {
        commit('INC_DEPLOY_STEP', 'two')
        commit('INC_DEPLOY_STEP', 'three')
        console.log('tx')
        // this.deploying = false
        // this.confirming = true
        // this.tx = transactionHash
      }).on('error', () => {
        commit('SET_DEPLOY_STEP', {step: 'three', val: 0})
        console.log('error')
        // this.confirming = false
        // this.deploying = false
        // this.setLoading(false)
        // this.addNotification({
        //   text: 'Error has occured, please check logs',
        //   class: 'error'
        // })
      }).then((newContractInstance) => {
        commit('INC_DEPLOY_STEP', 'three')
        commit('SET_DEPLOY_STEP', {step: 'three', val: 2})
        console.log('done')
        poolContract = newContractInstance
        // this.setLoading(false)
        // this.confirming = false
        console.log(poolContract)
        commit('INC_DEPLOY_STEP', 'four')
        axios.post(apiUrl('/pools'), {
          address: poolContract.options.address,
          ownerAddress: state.account,
          name: pool.name,
          symbol: pool.symbol,
          type: 'linear',
          base: 'DAI',
          baseToken: baseToken,
          networkId: state.network,
          links: []
        }).then(({ data }) => {
          commit('INC_DEPLOY_STEP', 'four')
          dispatch('getPools')
        }).catch((err) => {
          console.log(err)
        })
        commit('UPDATE_CURRENT_POOL', poolContract.options.address)
        // this.address = newContractInstance.options.address
      })
    })
  },
  deployContract ({state, commit}, poolAddress = state.poolAddress) {
    console.log(poolAddress)
    if (poolAddress) {
      console.log('deploy contract!', poolAddress)
      console.log(PoolContractArtifacts.abi)
      poolContract = new global.web3.eth.Contract(PoolContractArtifacts.abi, poolAddress)
      console.log('deploy baseToken!', state.pool.baseToken)
      console.log(ERC20ContractArtifacts.abi)
      baseContract = new global.web3.eth.Contract(ERC20ContractArtifacts.abi, state.pool.baseToken)
    }
  },
  callConstant ({commit, dispatch}, [functionName, parameters, contract = 'poolContact']) {
    if (!poolContract || !baseContract) {
      return dispatch('deploy').then(() => {
        return dispatch('callConstant', [functionName, parameters, contract])
      })
    } else {
      if (contract === 'poolContract') {
        return poolContract.methods[functionName].call(...parameters)
      } else {
        return baseContract.methods[functionName](...parameters).call()
      }
    }
  },
  callTransaction ({commit}, functionName, parameters) {
    if (!poolContract) return Promise((resolve, reject) => { resolve() })
    return poolContract.methods[functionName].send(...parameters)
  },
  mint: async ({state}, amount) => {
    if (!poolContract) return

    amount = utils.toBN(amount)
    let amountWei = utils.toBN(utils.toWei(amount.toString()))
    console.log(utils.fromWei(amountWei.toString()), 'amount')

    let allowance = await baseContract.methods.allowance(state.account, poolContract.options.address).call()
    allowance = utils.toBN(allowance)
    console.log(allowance.toString(), 'allowance')

    let baseContractBalance = await baseContract.methods.balanceOf(state.account).call()
    baseContractBalance = utils.toBN(baseContractBalance)
    console.log(utils.fromWei(baseContractBalance.toString()), 'baseContractBalance')
    console.log(amountWei)
    if (amountWei.gt(baseContractBalance)) {
      alert('you dont have enough')
      return
    }

    if (amountWei.gt(allowance)) {
      await baseContract.methods.approve(poolContract.options.address, amountWei).send({from: state.account})
    }

    // var beforeBalance = await poolContract.methods.balanceOf(state.account).call()

    var calculateMintTokenPerToken = await poolContract.methods.calculateMintTokenPerToken(amount).call()
    console.log(calculateMintTokenPerToken[1].toString(), 'transferFrom')

    try {
      await poolContract.methods.mint(state.account, amount).send({from: state.account})
      var afterBalance = await poolContract.methods.balanceOf(state.account).call()
      console.log('afterBalance', afterBalance.toString())
    } catch (error) {
      console.error(error)
    }
  },
  unmint ({commit}, amount) {

  },
  getBondBalance ({commit}) {
    if (!poolContract) return
    return poolContract.methods.getBalance.call().then((balance) => {
      console.log(balance)
    })
  },
  getPools ({ commit, state }) {
    axios.get(apiUrl('/pools'), {
      params: {
        networkId: state.network
      }
    }).then(({ data }) => {
      commit('GET_POOLS', data)
    }).catch((err) => {
      console.log(err)
    })
  },
  updateCurrentPool ({ commit }, pool) {
    commit('GET_POOL_DB', pool)
  },
  getPoolDb ({ commit }, address) {
    return new Promise((resolve, reject) => {
      axios.get(apiUrl(`/pools/${address}`)).then(({ data }) => {
        commit('GET_POOL_DB', data)
        resolve()
      }).catch((err) => {
        console.log(err)
        reject(err)
      })
    })
  },

  updateContract ({ commit, dispatch }, contract) {
    axios.put(apiUrl(`/pools/${contract.address}`), contract).then(({ data }) => {
      commit('GET_POOL_DB', data)
      dispatch('deployContract')
    }).catch((err) => {
      console.log(err)
    })
  }
}

function apiUrl (endpoint) {
  return process.env.API_BASE + endpoint
}
