/*******************************************************************************
 * Licensed Materials - Property of IBM
 * (c) Copyright IBM Corporation 2018. All Rights Reserved.
 *
 * Note to U.S. Government Users Restricted Rights:
 * Use, duplication or disclosure restricted by GSA ADP Schedule
 * Contract with IBM Corp.
 *******************************************************************************/

import React from 'react'
import { Search } from 'carbon-components-react'
import { Query } from 'react-apollo'
import { gql } from 'apollo-boost'


const GET_SEARCH_AUTOCOMPLETE = gql`
  query searchAutocomplete {
    searchAutocomplete
  }
`
class SearchInput extends React.PureComponent {

  render() {
    return (
      <Query query={GET_SEARCH_AUTOCOMPLETE}>
        {( { data, client } ) => {
          console.log('autocomplete data:', data) // eslint-disable-line no-console
          return (<div className='search--input-area'>
            <Search
              className='bx--search--light'
              labelText='Search resources'  // TODO searchFeature: NLS
              placeHolderText='Search resources' // TODO searchFeature: NLS
              defaultValue='MATCH (a) RETURN a LIMIT 100' // FIXME searchFeature: This is just for dev debug
              onChange={(evt) => {
                // TODO searchFeature: use a mutation with a schema.
                // TODO searchFeature: Need to debunce to limit the backend request.
                client.writeData({ data: {
                  searchInput: {
                    __typename: 'SearchInput', // TODO searchFeature: define schema
                    text: evt.target.value
                  }
                }} )
              }}
            />
          </div>
          )}
        }
      </Query>
    )
  }
}

export default SearchInput
